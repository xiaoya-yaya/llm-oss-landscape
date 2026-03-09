import { Project } from './types';

/**
 * Get a color for a programming language
 */
export const getLanguageColor = (language: string): string => {
  const colors = {
    JavaScript: '#f1e05a',
    TypeScript: '#2b7489',
    Python: '#3572A5',
    Java: '#b07219',
    C: '#555555',
    'C++': '#f34b7d',
    'C#': '#178600',
    Go: '#00ADD8',
    Ruby: '#701516',
    PHP: '#4F5D95',
    Rust: '#dea584',
    Scala: '#c22d40',
    Swift: '#ffac45',
    Kotlin: '#F18E33',
    HTML: '#e34c26',
    CSS: '#563d7c',
    Shell: '#89e051',
    Jupyter: '#DA5B0B',
    Dockerfile: '#384d54',
    'Jupyter Notebook': '#DA5B0B',
  };

  return colors[language] || '#777777';
};

/**
 * Format large numbers to compact form (e.g. 1.2K, 3.5M)
 */
export const formatNumber = (num: number | string): string => {
  // 将输入值转换为数字
  const numericValue = typeof num === 'string' ? parseFloat(num) : num;

  if (numericValue >= 1_000_000) {
    return (numericValue / 1_000_000).toFixed(1) + 'M';
  } else if (numericValue >= 1_000) {
    return (numericValue / 1_000).toFixed(1) + 'K';
  }

  // 返回原始值的字符串表示
  return num.toString();
};

/**
 * Format date strings (from YYYY/MM/DD to Month DD)
 */
export const formatDate = (dateString: string): string => {
  if (!dateString) return 'Unknown';

  try {
    const [year, month, day] = dateString.split('/');
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return `${months[parseInt(month) - 1]} ${day}, ${year}`;
  } catch (e) {
    return dateString;
  }
};

/**
 * Extract tags from project description
 */
export const extractTags = (description: string): string[] => {
  if (!description) return [];

  const tags: string[] = [];

  // Common AI-related keywords to look for
  const keywords = [
    'AI', 'ML', 'LLM', 'GPT', 'Agent', 'Vector',
    'Neural', 'Graph', 'Semantic', 'Transformer',
    'Inference', 'RAG', 'Embedding', 'Search',
    'Vision', 'Audio', 'Multimodal', 'Generative'
  ];

  keywords.forEach(keyword => {
    if (description.toLowerCase().includes(keyword.toLowerCase())) {
      tags.push(keyword);
    }
  });

  return tags.slice(0, 5); // Limit to 5 tags
};

/**
 * Process and load projects from CSV data with enhanced type safety
 */
export const loadProjectsFromData = (
  data: Record<string, any>[]
): Project[] => {
  return data.map((row, index) => {
    // Ensure all string fields are properly converted to strings
    const repoId = String(row.repo_id || index);
    const repoName = String(row.repo_name || '');
    const orgName = repoName ? repoName.split('/')[0] : '';
    const repoNameOnly = repoName ? repoName.split('/')[1] : '';

    // Determine classification with proper string conversion
    let classification = 'Uncategorized';
    if (row.classification && String(row.classification).trim() !== '') {
      classification = String(row.classification).trim();
    }

    // Parse numerical values with enhanced safety and comma handling
    const starsStr = String(row.stars || '0').replace(/,/g, '').trim();
    const forksStr = String(row.forks || '0').replace(/,/g, '').trim();
    const openrankStr = String(row.openrank_25 || row.openrank || '0').replace(/,/g, '').trim();

    const stars = isNaN(Number(starsStr)) ? 0 : Number(starsStr);
    const forks = isNaN(Number(forksStr)) ? 0 : Number(forksStr);
    const openrank = isNaN(Number(openrankStr)) ? 0 : Number(openrankStr);

    // Convert language and dates to proper strings
    const language = String(row.language || 'Unknown');
    const createdAt = String(row.created_at || '');
    const description = String(row.description || '');

    // Calculate size based on popularity metrics
    const calculateSize = () => {
      const starsScore = Math.min(stars / 50000, 1); // Max at 50k stars
      const forksScore = Math.min(forks / 10000, 1);  // Max at 10k forks
      const openrankScore = Math.min(openrank / 300, 1); // Max at 300 openrank

      const score = (starsScore * 0.3) + (forksScore * 0.2) + (openrankScore * 0.5);

      return {
        width: Math.round(100 + (score * 60)), // 100px to 160px, rounded for safety
        height: Math.round(100 + (score * 60))  // 100px to 160px, rounded for safety
      };
    };

    // Construct project object with proper type conversions
    return {
      id: repoId,
      name: repoName,
      classification: classification,
      stars: stars,
      forks: forks,
      openrank: openrank,
      language: language,
      created_at: createdAt,
      description: description,
      github_url: repoName ? `https://github.com/${repoName}` : '',
      logo: `/img/logos/${orgName}.png`,
      fallbackLogo: `https://github.com/${orgName}.png`,
      displayName: repoNameOnly,
      tags: extractTags(description),
      size: calculateSize(),
    };
  });
};

/**
 * Fetch and process CSV data with improved parsing and error handling
 */
export const fetchAndProcessCsvData = async (
  csvPath: string
): Promise<Project[]> => {
  try {
    console.log(`Fetching CSV from ${csvPath}...`);
    const response = await fetch(csvPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch from ${csvPath}: ${response.status}`);
    }

    const csvText = await response.text();
    if (csvText.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Fix for HTML being returned instead of CSV
    if (csvText.trim().startsWith('<')) {
      console.error('Received HTML instead of CSV data');
      throw new Error('Invalid CSV format: received HTML');
    }

    // Parse CSV with improved algorithm
    const lines = csvText.split('\n').filter(line => line.trim());
    console.log(`CSV has ${lines.length} non-empty lines`);

    // Extract the essential headers (ignore excess commas in header line)
    const headerLine = lines[0];
    const essentialHeaders = headerLine.split(',').filter(h => h.trim() !== '');
    console.log('Essential CSV Headers:', essentialHeaders);

    // Create data array
    const data: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      // Skip empty lines
      if (!line.trim()) continue;

      // Improved parsing with better quote handling
      let values: string[] = [];
      let inQuotes = false;
      let currentValue = '';

      for (let j = 0; j < line.length; j++) {
        const char = line[j];

        if (char === '"') {
          // Handle double quotes
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          // Found a field separator
          values.push(currentValue);
          currentValue = '';
        } else {
          // Add character to current value
          currentValue += char;
        }
      }

      // Add the last value
      values.push(currentValue);

      // Trim to essential values (matching essential headers)
      const essentialValues = values.slice(0, essentialHeaders.length);

      // If we have fewer values than headers, pad with empty strings
      while (essentialValues.length < essentialHeaders.length) {
        essentialValues.push('');
      }

      // Create row object with essential headers and values
      const row: Record<string, string> = {};
      essentialHeaders.forEach((header, index) => {
        // Ensure all values are properly trimmed strings
        row[header] = (essentialValues[index] || '').trim();

        // Fix numeric fields that might be empty
        if ((header === 'stars' || header === 'forks' || header === 'openrank_25') && (!row[header] || row[header] === '')) {
          row[header] = '0';
        }
      });

      // Check for minimum required fields
      if (row.repo_id && row.repo_name) {
        data.push(row);
      } else {
        console.warn(`Line ${i} missing essential data, skipping: ${JSON.stringify(row)}`);
      }
    }

    console.log(`Successfully parsed ${data.length} rows from CSV data`);

    // Convert to Project objects
    return loadProjectsFromData(data);
  } catch (error) {
    console.error('Error fetching or processing CSV:', error);
    throw error;
  }
};

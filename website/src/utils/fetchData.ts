import Papa from 'papaparse';

interface FetchDataOptions {
    url: string;
    type: 'json' | 'csv';
}

async function fetchData<T = any>(options: FetchDataOptions): Promise<T> {
    const { url, type } = options;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (type === 'json') {
            return await response.json() as T;
        } else if (type === 'csv') {
            const csvString = await response.text();
            const results  = Papa.parse(csvString, {
                header: true,
            });
            return results.data as T;
        }
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

export default fetchData;

import React from 'react';

// Redirect to Interactive Landscape page
export default function Home(): JSX.Element {
  React.useEffect(() => {
    window.location.href = '/interactive-landscape';
  }, []);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#666'
    }}>
      Redirecting to Interactive Landscape...
    </div>
  );
}

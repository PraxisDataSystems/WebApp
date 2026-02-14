'use client'

import { useState } from 'react'

export default function Home() {
  const [status, setStatus] = useState('Ready')

  const handleExport = () => {
    setStatus('Export triggered (not connected)')
    setTimeout(() => setStatus('Ready'), 3000)
  }

  return (
    <main>
      <h1 style={{ marginBottom: '1rem' }}>Propstream Export Manager</h1>
      
      <div style={{ 
        padding: '1.5rem', 
        border: '1px solid #ddd', 
        borderRadius: '8px',
        maxWidth: '500px'
      }}>
        <h2 style={{ marginTop: 0 }}>Property Lists</h2>
        
        <div style={{ marginBottom: '1rem' }}>
          <p><strong>Vol Flip - New</strong></p>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>List ID: 5137566</p>
        </div>

        <button 
          onClick={handleExport}
          style={{
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Export Properties
        </button>

        <p style={{ 
          marginTop: '1rem', 
          padding: '0.5rem',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px'
        }}>
          Status: {status}
        </p>
      </div>

      <div style={{ marginTop: '2rem', color: '#666', fontSize: '0.85rem' }}>
        <p>This is a minimal UI. Agent automation runs separately on the server.</p>
      </div>
    </main>
  )
}

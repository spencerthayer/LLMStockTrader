import { StrictMode, Component, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// #region agent log
fetch('http://127.0.0.1:7246/ingest/e74a6fed-0be4-43c3-aabb-46a1af95b1a3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.tsx:entry',message:'main_entry_before_render',data:{rootExists:!!document.getElementById('root')},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
// #endregion

class DebugErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // #region agent log
    fetch('http://127.0.0.1:7246/ingest/e74a6fed-0be4-43c3-aabb-46a1af95b1a3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.tsx:ErrorBoundary',message:'render_error_caught',data:{errorMessage:error?.message,componentStack:String(info?.componentStack||'').slice(0,500)},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: 'sans-serif', background: '#1a1a1a', color: '#eee', minHeight: '100vh' }}>
          <h1>Something went wrong</h1>
          <p>Check the console or debug log for details.</p>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DebugErrorBoundary>
      <App />
    </DebugErrorBoundary>
  </StrictMode>,
)

import { Toaster } from 'react-hot-toast'

// Toasts styled with the theme tokens, so they follow light and dark mode.
const AppToaster = () => (
  <Toaster
    position="top-center"
    gutter={10}
    toastOptions={{
      duration: 3500,
      style: {
        background: 'var(--panel-solid)',
        color: 'var(--text)',
        border: '1px solid var(--border-strong)',
        borderRadius: '14px',
        boxShadow: 'var(--shadow-md)',
        fontSize: '14px',
        padding: '10px 14px',
      },
      success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
      error: { duration: 5000, iconTheme: { primary: '#f43f5e', secondary: '#fff' } },
    }}
  />
);

export default AppToaster

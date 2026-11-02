import ReactDOM from 'react-dom/client'
import '@fontsource-variable/inter'
import '@/index.css'
import App from '@/App'
import { registerBundledIcons } from '@/lib/iconify'

registerBundledIcons()

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)

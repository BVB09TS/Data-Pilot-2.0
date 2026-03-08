import { ThemeProvider } from './contexts/ThemeContext'
import { Shell } from './components/layout/Shell'

export default function App() {
  return (
    <ThemeProvider>
      <Shell />
    </ThemeProvider>
  )
}

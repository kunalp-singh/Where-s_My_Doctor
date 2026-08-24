import '../styles/globals.css'
import { AuthProvider } from '../lib/AuthContext'
import { Navbar } from '../components/Navbar'

export const metadata = {
  title: 'Appointment Care',
  description: 'AI-Powered Healthcare Appointment & Care Portal',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body className="min-h-screen bg-[#f1f6f2] text-[#21322a]">
        <AuthProvider>
          <Navbar />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}

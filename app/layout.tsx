import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Propstream Automation - Real Estate Wholesaling',
  description: 'Automated property evaluation and lead generation',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <div className="min-h-screen bg-background">
          <nav className="border-b">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-8">
                  <Link href="/" className="text-xl font-bold">
                    Propstream Pro
                  </Link>
                  <div className="flex space-x-4">
                    <Link href="/" className="text-sm hover:text-primary">
                      Dashboard
                    </Link>
                    <Link href="/properties" className="text-sm hover:text-primary">
                      Properties
                    </Link>
                    <Link href="/config" className="text-sm hover:text-primary">
                      Configuration
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </nav>
          <main className="container mx-auto px-4 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}

import "./globals.css";

export const metadata = {
  title: "Extro: Activities Feed",
  description: "Spontaneous activities with friends and groups",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

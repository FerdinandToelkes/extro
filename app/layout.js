import "./globals.css";

export const metadata = {
  title: "Aktivitäten-Feed",
  description: "Spontane Aktivitäten mit Freunden organisieren",
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}

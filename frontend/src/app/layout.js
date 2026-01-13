export const metadata = {
    title: "AutoForm Filler",
    description: "Save profile once and auto-fill forms using the Chrome extension.",
  };
  
  export default function RootLayout({ children }) {
    return (
      <html lang="en">
        <body style={{ margin: 0, fontFamily: "system-ui, Arial, sans-serif" }}>
          {children}
        </body>
      </html>
    );
  }
  
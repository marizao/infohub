import React, { useEffect } from "react";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Table from "./components/Table";
import Sidebar from "./components/Sidebar"; // Importamos a nova barra lateral!

const App = () => {
  useEffect(() => {
    // F5 DA MADRUGADA
    const checkTime = setInterval(() => {
      if (new Date().getHours() === 3) window.location.reload(true);
    }, 3600000); 

    // DETETIVE DE ATUALIZAÇÃO NO VERCEL
    let currentHtml = null;
    const checkForUpdates = async () => {
      try {
        const res = await fetch(`/?v=${new Date().getTime()}`);
        const html = await res.text();
        if (currentHtml === null) currentHtml = html;
        else if (currentHtml !== html) window.location.reload(true);
      } catch (error) {
        console.error("Modo offline", error);
      }
    };

    const updateInterval = setInterval(checkForUpdates, 60000);
    return () => { clearInterval(checkTime); clearInterval(updateInterval); };
  }, []);

  return (
    <div className="app-container">
      <Header />
      
      {/* Container flexível que coloca a tabela e o banner lado a lado */}
      <div className="content-wrapper">
        <main className="main-content">
          <Table />
        </main>
        <aside className="sidebar-wrapper">
          <Sidebar />
        </aside>
      </div>

      <Footer />
    </div>
  );
};

export default App;
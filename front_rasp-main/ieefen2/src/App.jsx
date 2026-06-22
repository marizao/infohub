import React, { useEffect, useState } from "react";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Table from "./components/Table";
import Sidebar from "./components/Sidebar"; 

const App = () => {
  // Estado inteligente para esconder a barra
  const [hasBanners, setHasBanners] = useState(true);

  useEffect(() => {
    const checkTime = setInterval(() => {
      if (new Date().getHours() === 3) window.location.reload(true);
    }, 3600000); 

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
      
      <div className="content-wrapper">
        <main className="main-content">
          <Table />
        </main>
        
        {/* A MÁGICA: Se não houver banner, ela oculta a lateral.
            Usamos 'display: none' para o componente continuar existindo invisível 
            e poder voltar sozinho caso você adicione um banner depois! */}
        <aside className="sidebar-wrapper" style={{ display: hasBanners ? 'flex' : 'none' }}>
          <Sidebar setHasBanners={setHasBanners} />
        </aside>
      </div>

      <Footer />
    </div>
  );
};

export default App;
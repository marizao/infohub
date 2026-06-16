import React, { useEffect } from "react";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Table from "./components/Table";

const App = () => {
  useEffect(() => {
    // 1. O F5 DA MADRUGADA (Limpa a memória da TV para não travar após dias ligada)
    const checkTime = setInterval(() => {
      const horaAtual = new Date().getHours();
      if (horaAtual === 3) {
        window.location.reload(true); 
      }
    }, 3600000); 

    // 2. DETETIVE DE ATUALIZAÇÃO (Auto-Update após Git Push)
    let currentHtml = null;
    
    const checkForUpdates = async () => {
      try {
        // Busca o HTML do Vercel quebrando o cache
        const res = await fetch(`/?v=${new Date().getTime()}`);
        const html = await res.text();
        
        // Na primeira vez, apenas memoriza como é o HTML atual
        if (currentHtml === null) {
          currentHtml = html;
        } 
        // Se o HTML que ele achou for diferente do memorizado, alguém deu deploy!
        else if (currentHtml !== html) {
          console.log("Novo deploy detectado no Vercel! A TV vai recarregar sozinha...");
          window.location.reload(true); // Força o F5
        }
      } catch (error) {
        console.error("Modo offline: Falha ao buscar nova versão do painel.", error);
      }
    };

    // A TV vai checar se tem código novo a cada 1 minuto (60000 milissegundos)
    const updateInterval = setInterval(checkForUpdates, 60000);

    return () => {
      clearInterval(checkTime);
      clearInterval(updateInterval);
    };
  }, []);

  return (
    <>
      <div className="app-container">
        <Header />
        <main className="main-content">
          <Table />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default App;
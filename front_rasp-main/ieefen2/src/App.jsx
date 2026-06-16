import React, { useEffect } from "react";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Table from "./components/Table";

const App = () => {
  useEffect(() => {
    // Verifica a cada 1 hora se é madrugada (ex: 3h da manhã)
    const checkTime = setInterval(() => {
      const horaAtual = new Date().getHours();
      if (horaAtual === 3) {
        window.location.reload(true); // F5 automático forçado
      }
    }, 3600000); 

    return () => clearInterval(checkTime);
  }, []);

  return (
    <div className="app-container">
      <Header />
      <main className="main-content">
        <Table />
      </main>
      <Footer />
    </div>
  );
};

export default App;
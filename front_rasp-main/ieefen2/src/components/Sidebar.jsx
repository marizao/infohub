import React, { useState, useEffect } from "react";

const Sidebar = ({ setHasBanners }) => {
  const [banners, setBanners] = useState([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  // Busca os banners e avisa o App.jsx
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const timestamp = new Date().getTime();
        const response = await fetch(`/banners.json?v=${timestamp}`);
        const data = await response.json();
        
        if (data && data.length > 0) {
          data.sort((a, b) => a.ordem - b.ordem);
          setBanners(data);
          setHasBanners(true); // Diz ao App para mostrar o espaço da lateral
        } else {
          setHasBanners(false); // Diz ao App para apagar a coluna e expandir a tabela
        }
      } catch (err) {
        console.error("Erro ao carregar banners:", err);
        setHasBanners(false); // Se o arquivo JSON for deletado, também expande a tabela
      }
    };

    fetchBanners();
    
    // Robô que verifica se chegou banner novo a cada 5 minutos
    const interval = setInterval(fetchBanners, 300000);
    return () => clearInterval(interval);
  }, [setHasBanners]);

  // Roda o carrossel
  useEffect(() => {
    if (banners.length > 0) {
      const interval = setInterval(() => {
        setCurrentBannerIndex((prevIndex) => (prevIndex + 1) % banners.length);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [banners]);

  if (banners.length === 0) return null;

  const banner = banners[currentBannerIndex];

  return (
    <div className="sidebar-container">
      <img
        className="sidebar-banner"
        src={banner.url}
        alt={banner.alt_text || "Banner do Evento"}
      />
    </div>
  );
};

export default Sidebar;
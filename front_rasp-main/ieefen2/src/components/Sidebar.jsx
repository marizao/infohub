import React, { useState, useEffect } from "react";

const Sidebar = () => {
  const [banners, setBanners] = useState([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Busca os banners do JSON
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const timestamp = new Date().getTime();
        const response = await fetch(`/banners.json?v=${timestamp}`);
        const data = await response.json();
        data.sort((a, b) => a.ordem - b.ordem);
        setBanners(data);
      } catch (err) {
        console.error("Erro ao carregar banners:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchBanners();
  }, []);

  // Roda o carrossel de 1 em 1
  useEffect(() => {
    if (banners.length > 0) {
      const interval = setInterval(() => {
        setCurrentBannerIndex((prevIndex) => (prevIndex + 1) % banners.length);
      }, 10000); // Troca a cada 10 segundos
      return () => clearInterval(interval);
    }
  }, [banners]);

  if (loading || banners.length === 0) {
    return (
      <div className="sidebar-container">
        <p style={{ color: "#64748b", fontWeight: "600" }}>
          {loading ? "Carregando evento..." : "Nenhum evento no momento"}
        </p>
      </div>
    );
  }

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
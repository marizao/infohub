import React, { useState, useEffect } from "react";

const Footer = () => {
  const [banners, setBanners] = useState([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Caminho relativo para pegar os banners locais na TV
  const JSON_API_URL2 = "/banners.json"; 

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const timestamp = new Date().getTime();
        const urlComCacheBusting = `${JSON_API_URL2}?v=${timestamp}`;
        
        const response = await fetch(urlComCacheBusting);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        data.sort((a, b) => a.ordem - b.ordem);
        setBanners(data);
      } catch (err) {
        setError(err);
        console.error("Erro ao carregar banners:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, []);

  // Lógica de rotação alterada: pula de 1 em 1 banner
  useEffect(() => {
    if (banners.length > 0) {
      const interval = setInterval(() => {
        setCurrentBannerIndex((prevIndex) => {
          const nextIndex = prevIndex + 1; // Pula de 1 em 1
          if (nextIndex >= banners.length) {
            return 0; // Volta para o primeiro se chegar no fim
          }
          return nextIndex;
        });
      }, 10000); // Troca a cada 10 segundos

      return () => clearInterval(interval);
    }
  }, [banners]);

  if (loading) {
    return (
      <div className="footer-container">
        <div className="footer-text">
          <p>Carregando banners...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="footer-container">
        <div className="footer-text">
          <p>Erro ao carregar banners: {error.message}</p>
        </div>
      </div>
    );
  }

  if (banners.length === 0) {
    return (
      <div className="footer-container">
        <div className="footer-text">
          <p>Nenhum banner disponível.</p>
        </div>
      </div>
    );
  }

  // Pegamos apenas 1 banner por vez agora
  const banner1 = banners[currentBannerIndex];

  return (
    <div className="footer-container">
      <div className="footer-content">
        {banner1 && (
          <img
            className="banner"
            src={banner1.url}
            alt={banner1.alt_text || `Banner ${banner1.id}`}
          />
        )}
      </div>
      <div className="footer-text">
        <p>Desenvolvido por: Julio Constantino, Marco Aurélio</p>
      </div>
    </div>
  );
};

export default Footer;
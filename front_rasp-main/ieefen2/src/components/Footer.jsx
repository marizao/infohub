import React, { useState, useEffect } from "react";

const Footer = () => {
  const [banners, setBanners] = useState([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        // Quebrando o cache do Vercel para os banners também
        const timestamp = new Date().getTime();
        const JSON_API_URL2 = `/banners.json?v=${timestamp}`;

        const response = await fetch(JSON_API_URL2);
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
    
    // Opcional: recarregar os banners a cada 1 hora para pegar novos eventos
    const refreshBanners = setInterval(fetchBanners, 3600000);
    return () => clearInterval(refreshBanners);
  }, []);

  useEffect(() => {
    if (banners.length > 0) {
      const interval = setInterval(() => {
        setCurrentBannerIndex((prevIndex) => {
          const nextIndex = prevIndex + 2;
          if (nextIndex >= banners.length) {
            return 0;
          }
          return nextIndex;
        });
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [banners]);

  if (loading) {
    return (
      <div className="footer-container">
        <div className="footer-text">
          <p>Carregando banners...</p>
        </div>
        <p>Desenvolvido por: Julio Constantino, Marco Aurélio</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="footer-container">
        <div className="footer-text">
          <p>Erro ao carregar banners: {error.message}</p>
        </div>
        <p>Desenvolvido por: Julio Constantino, Marco Aurélio</p>
      </div>
    );
  }

  if (banners.length === 0) {
    return (
      <div className="footer-container">
        <div className="footer-text">
          <p>Nenhum banner disponível.</p>
        </div>
        <p>Desenvolvido por: Julio Constantino, Marco Aurélio</p>
      </div>
    );
  }
  const banner1 = banners[currentBannerIndex];
  const banner2 = banners[currentBannerIndex + 1];

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
        {banner2 && (
          <img
            className="banner"
            src={banner2.url}
            alt={banner2.alt_text || `Banner ${banner2.id}`}
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
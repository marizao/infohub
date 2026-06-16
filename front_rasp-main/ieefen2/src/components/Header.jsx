import React from "react";
import logoIEEE from "/assets/logoieeeuerjbranca.png";
import logoFen from "/assets/logofen.jpg";
import bannerpro from "/assets/banner_pt.png";
import DigitalClock from "./Digitalclock";

const Header = () => {
  return (
    <div className="header-container">
      <div className="header-content">
        <img className="logo-esquerda" src={logoIEEE} alt="" />
        <div className="title">
          <h1>Horários das Aulas</h1>
          <DigitalClock />
        </div>
        <img className="logo-direita" src={logoFen} alt="" />
        {/* <img src={bannerpro} alt="" /> */}
      </div>
    </div>
  );
};

export default Header;

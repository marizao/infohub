import React, { useEffect, useState } from "react";
import axios from "axios";

const Table = () => {
  const [data, setData] = useState([]);
  const [startIndex, setStartIndex] = useState(0);
  const [currentTimeNow, setCurrentTimeNow] = useState(new Date()); 
  
  // NOVO: Começamos com um valor seguro, mas a TV vai calcular isso sozinha.
  const [itemsPerPage, setItemsPerPage] = useState(8); 
  const updateInterval = 15000; 

  // 1. Relógio interno
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTimeNow(new Date());
    }, 60000); 
    return () => clearInterval(timeInterval);
  }, []);

  // 2. NOVO: Detetive de Tamanho de Tela (Auto-Scale)
  useEffect(() => {
    const adjustTableSize = () => {
      // Pega a altura real da TV em pixels
      const screenHeight = window.innerHeight;
      
      // LÓGICA:
      // O Cabeçalho, o Rodapé e as margens azuis ocupam cerca de 350px.
      // O espaço que sobra é exclusivamente para as linhas de aula.
      const availableHeightForRows = screenHeight - 350; 
      
      // Uma linha nossa tem em média de 70px de altura.
      // Dividimos o espaço que sobrou por 70 para ver quantas linhas cabem exatas!
      let calculatedRows = Math.floor(availableHeightForRows / 70);
      
      // Travas de segurança: Nunca mostrar menos que 4 aulas e nunca mais de 14.
      if (calculatedRows < 4) calculatedRows = 4;
      if (calculatedRows > 14) calculatedRows = 14;

      setItemsPerPage(calculatedRows);
    };

    // Calcula imediatamente assim que a página carrega
    adjustTableSize(); 
    
    // Se por acaso alguém redimensionar a tela, ele recalcula sozinho
    window.addEventListener("resize", adjustTableSize); 
    return () => window.removeEventListener("resize", adjustTableSize);
  }, []);

  // 3. Buscar dados da API
  useEffect(() => {
    const fetchHorarios = () => {
      const timestamp = new Date().getTime();
      const JSON_API_URL = `/horarios2.json?v=${timestamp}`;

      axios
        .get(JSON_API_URL)
        .then((res) => setData(res.data))
        .catch((err) => {
          console.error("Modo offline: Falha ao atualizar horários. Mantendo dados antigos.", err);
        });
    };

    fetchHorarios();
    const fetchInterval = setInterval(fetchHorarios, 300000);
    return () => clearInterval(fetchInterval);
  }, []);

  // // 4. Lógica de Filtro
  // const dayName = ["domingo", "seg", "ter", "qua", "qui", "sex", "sábado"];
  // const today = dayName[currentTimeNow.getDay()];
  // const currentHour = currentTimeNow.getHours();
  // const currentMinute = currentTimeNow.getMinutes();

  // const filteredData = data.filter((user) => {
  //   if (!user["HORÁRIO_INICIAL"] || !user["HORÁRIO_FINAL"]) return false;

  //   const [startHour, startMinute] = user["HORÁRIO_INICIAL"].split(":").map(Number);
  //   const [endHour, endMinute] = user["HORÁRIO_FINAL"].split(":").map(Number);

  //   const startTime = startHour * 60 + startMinute;
  //   const endTime = endHour * 60 + endMinute;
  //   const currentTime = currentHour * 60 + currentMinute;

  //   return (
  //     user["DIA_DA_SEMANA"]?.trim().toLowerCase() === today &&
  //     currentTime >= startTime - 300 &&
  //     currentTime < endTime
  //   );
  // });

  // 4. Lógica de Filtro (TEMPORARIAMENTE DESLIGADA PARA TESTE DE LAYOUT)
  const filteredData = data.filter((user) => {
    // Apenas verifica se a aula tem um horário válido e manda exibir tudo!
    if (!user["HORÁRIO_INICIAL"] || !user["HORÁRIO_FINAL"]) return false;
    return true; 
  });

  filteredData.sort((a, b) => {
    const horarioA = a["HORÁRIO_INICIAL"];
    const horarioB = b["HORÁRIO_INICIAL"];
    if (horarioA < horarioB) return -1;
    if (horarioA > horarioB) return 1;
    return 0;
  });

  // 5. Paginação adaptada para o número dinâmico
  useEffect(() => {
    const interval = setInterval(() => {
      setStartIndex((prev) => {
        const nextIndex = prev + itemsPerPage;
        return nextIndex >= filteredData.length ? 0 : nextIndex; 
      });
    }, updateInterval);

    return () => clearInterval(interval);
  }, [filteredData, itemsPerPage]);

  const paginatedData = filteredData.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  if (filteredData.length === 0) {
    return (
      <div className="table-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#64748b' }}>
        <svg style={{ width: '80px', height: '80px', marginBottom: '20px', opacity: '0.5' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" /></svg>
        <h2 style={{ fontSize: '2rem', fontWeight: '600', margin: '0' }}>Turno Encerrado</h2>
        <p style={{ fontSize: '1.2rem', marginTop: '10px' }}>Não há aulas programadas para este momento.</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <div className="c">
        <table id="schedule-table">
          <thead>
            <tr>
              <th>DISCIPLINA</th>
              <th>SALA</th>
              <th>PROFESSOR</th>
              <th>TURMA</th>
              <th>HORÁRIO INICIAL</th>
              <th>HORÁRIO FINAL</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((user, index) => (
              <tr key={index}>
                <td>{user.DISCIPLINA}</td>
                <td>{user.SALA}</td>
                <td>{user.PROFESSOR}</td>
                <td align="center">{user["TURMA"]}</td>
                <td align="center">{user["HORÁRIO_INICIAL"]}</td>
                <td align="center">{user["HORÁRIO_FINAL"]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Table;
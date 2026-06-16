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

  // 4. Lógica de Filtro
  const dayName = ["domingo", "seg", "ter", "qua", "qui", "sex", "sábado"];
  const today = dayName[currentTimeNow.getDay()];
  const currentHour = currentTimeNow.getHours();
  const currentMinute = currentTimeNow.getMinutes();

  const filteredData = data.filter((user) => {
    if (!user["HORÁRIO_INICIAL"] || !user["HORÁRIO_FINAL"]) return false;

    const [startHour, startMinute] = user["HORÁRIO_INICIAL"].split(":").map(Number);
    const [endHour, endMinute] = user["HORÁRIO_FINAL"].split(":").map(Number);

    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;
    const currentTime = currentHour * 60 + currentMinute;

    return (
      user["DIA_DA_SEMANA"]?.trim().toLowerCase() === today &&
      currentTime >= startTime - 300 &&
      currentTime < endTime
    );
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
import React, { useEffect, useState } from "react";
import axios from "axios";

const Table = () => {
  const [data, setData] = useState([]);
  const [startIndex, setStartIndex] = useState(0);
  
  // Estado para manter a hora atualizada em tempo real no painel
  const [currentTimeNow, setCurrentTimeNow] = useState(new Date()); 
  
  const itemsPerPage = 6;
  const updateInterval = 15000; 

  // 1. Relógio interno para o painel não "congelar" no tempo
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTimeNow(new Date());
    }, 60000); // Atualiza a hora a cada 1 minuto
    return () => clearInterval(timeInterval);
  }, []);

// 2. Buscar dados da API quebrando o cache do Vercel
  useEffect(() => {
    const fetchHorarios = () => {
      // O timestamp força o Vercel a baixar o JSON mais recente
      const timestamp = new Date().getTime();
      const JSON_API_URL = `/horarios2.json?v=${timestamp}`;

      axios.get(JSON_API_URL)
        .then((res) => setData(res.data))
        .catch((err) => {
          console.error("Modo offline: Falha ao atualizar horários. Mantendo dados antigos.", err);
          // O setData([]) foi removido daqui para manter a tabela na tela se a internet cair
        });
    }; // <--- ESSA CHAVE AQUI ESTAVA FALTANDO NO SEU CÓDIGO!

    fetchHorarios();

    // Atualiza o JSON a cada 5 minutos automaticamente sem precisar dar F5
    const fetchInterval = setInterval(fetchHorarios, 300000);
    return () => clearInterval(fetchInterval);
  }, []);

  // 3. Filtrando os dados usando o tempo real
  const dayName = ["domingo", "seg", "ter", "qua", "qui", "sex", "sábado"];
  const today = dayName[currentTimeNow.getDay()];
  const currentHour = currentTimeNow.getHours();
  const currentMinute = currentTimeNow.getMinutes();

// Desligando o filtro só para testar se a tabela renderiza
  const filteredData = data;

  filteredData.sort((a, b) => {
    const horarioA = a["HORÁRIO_INICIAL"];
    const horarioB = b["HORÁRIO_INICIAL"];
    if (horarioA < horarioB) return -1;
    if (horarioA > horarioB) return 1;
    return 0;
  });

  // 4. Paginação
  useEffect(() => {
    const interval = setInterval(() => {
      setStartIndex((prev) => {
        const nextIndex = prev + itemsPerPage;
        return nextIndex >= filteredData.length ? 0 : nextIndex; 
      });
    }, updateInterval);

    return () => clearInterval(interval);
  }, [filteredData]);

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
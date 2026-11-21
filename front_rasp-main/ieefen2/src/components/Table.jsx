import React, { useEffect, useState } from "react";
import axios from "axios";

// Converte "HH:MM" (ou "HH:MM:SS") em minutos totais desde 00:00
const paraMinutos = (horarioStr) => {
  if (!horarioStr) return null;
  const [horas, minutos] = horarioStr.substring(0, 5).split(":").map(Number);
  if (Number.isNaN(horas) || Number.isNaN(minutos)) return null;
  return horas * 60 + minutos;
};

// Normaliza o dia da semana para "seg", "ter", "qua", "qui", "sex", "sab", "dom"
const normalizarDia = (diaStr) => {
  if (!diaStr) return "";
  return diaStr
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .substring(0, 3);
};

// Retorna o dia e a hora atual no fuso de Brasília (ou via URL se estiver demonstrando fora de hora)
const obterTempoReferencia = (dataBase) => {
  const params = new URLSearchParams(window.location.search);
  const diaSimulado = params.get("dia");
  const horaSimulada = params.get("hora");

  if (diaSimulado && horaSimulada) {
    const minSimulados = paraMinutos(horaSimulada);
    if (minSimulados !== null) {
      return {
        dia: normalizarDia(diaSimulado),
        minutos: minSimulados,
      };
    }
  }

  const dataBrasilia = new Date(
    dataBase.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  const diasSemana = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

  return {
    dia: diasSemana[dataBrasilia.getDay()],
    minutos: dataBrasilia.getHours() * 60 + dataBrasilia.getMinutes(),
  };
};

const Table = () => {
  const [data, setData] = useState([]);
  const [startIndex, setStartIndex] = useState(0);
  const [currentTimeNow, setCurrentTimeNow] = useState(new Date());
  const [itemsPerPage, setItemsPerPage] = useState(8);
  const updateInterval = 15000;

  // 1. Relógio interno (atualiza a cada 30 segundos para trocar de turno na hora exata)
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTimeNow(new Date());
    }, 30000);
    return () => clearInterval(timeInterval);
  }, []);

  // 2. Detetive de Tamanho de Tela (Ajustado para texto duplo)
  useEffect(() => {
    const adjustTableSize = () => {
      const screenHeight = window.innerHeight;
      const availableHeightForRows = screenHeight - 300;

      let calculatedRows = Math.floor(availableHeightForRows / 85);

      if (calculatedRows < 4) calculatedRows = 4;
      if (calculatedRows > 12) calculatedRows = 12;

      setItemsPerPage(calculatedRows);
    };

    adjustTableSize();
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
          console.error("Falha ao atualizar horários.", err);
        });
    };

    fetchHorarios();
    const fetchInterval = setInterval(fetchHorarios, 300000);
    return () => clearInterval(fetchInterval);
  }, []);

  // 4. Lógica de Filtro em Tempo Real (Modo Produção)
  const { dia: diaAtual, minutos: minutosAtuais } =
    obterTempoReferencia(currentTimeNow);

  const filteredData = data.filter((aula) => {
    if (!aula["HORÁRIO_INICIAL"] || !aula["HORÁRIO_FINAL"] || !aula["DIA_DA_SEMANA"]) {
      return false;
    }

    if (normalizarDia(aula["DIA_DA_SEMANA"]) !== diaAtual) {
      return false;
    }

    const inicio = paraMinutos(aula["HORÁRIO_INICIAL"]);
    const fim = paraMinutos(aula["HORÁRIO_FINAL"]);
    if (inicio === null || fim === null) return false;

    // Exibe aulas que começam em até 15 minutos (troca de turno) até o horário de término
    return minutosAtuais >= inicio - 15 && minutosAtuais <= fim;
  });

  filteredData.sort((a, b) => {
    const horarioA = a["HORÁRIO_INICIAL"];
    const horarioB = b["HORÁRIO_INICIAL"];
    if (horarioA < horarioB) return -1;
    if (horarioA > horarioB) return 1;
    return 0;
  });

  // 5. Paginação
  useEffect(() => {
    const interval = setInterval(() => {
      setStartIndex((prev) => {
        const nextIndex = prev + itemsPerPage;
        return nextIndex >= filteredData.length ? 0 : nextIndex;
      });
    }, updateInterval);

    return () => clearInterval(interval);
  }, [filteredData.length, itemsPerPage]);

  const safeStartIndex = startIndex >= filteredData.length ? 0 : startIndex;
  const paginatedData = filteredData.slice(
    safeStartIndex,
    safeStartIndex + itemsPerPage
  );

  if (filteredData.length === 0) {
    return (
      <div
        className="table-container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          color: "#64748b",
        }}
      >
        <svg
          style={{ width: "80px", height: "80px", marginBottom: "20px", opacity: "0.5" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z"
          />
        </svg>
        <h2 style={{ fontSize: "2rem", fontWeight: "600", margin: "0" }}>
          Turno Encerrado
        </h2>
        <p style={{ fontSize: "1.2rem", marginTop: "10px" }}>
          Não há aulas programadas para este momento.
        </p>
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
              <th>TURMA</th>
              <th>PROFESSOR</th>
              <th>HORÁRIO INICIAL</th>
              <th>HORÁRIO FINAL</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((user, index) => (
              <tr key={`${user.DISCIPLINA}-${user.TURMA}-${user.SALA}-${index}`}>
                <td>{user.DISCIPLINA}</td>
                <td>{user.SALA}</td>
                <td align="center">{user["TURMA"]}</td>
                <td>{user.PROFESSOR}</td>
                <td align="center">{user["HORÁRIO_INICIAL"]?.substring(0, 5)}</td>
                <td align="center">{user["HORÁRIO_FINAL"]?.substring(0, 5)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Table;
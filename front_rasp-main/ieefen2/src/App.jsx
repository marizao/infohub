import Header from "./components/Header";
import Footer from "./components/Footer";
import Table from "./components/Table";

const App = () => {
  return (
    <>
      <div className="app-container">
        <Header />
        <main className="main-content">
          <Table />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default App;

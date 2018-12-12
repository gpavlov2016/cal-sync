import React, { Component } from "react";
import styles from "./App.module.scss";
class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      data: []
    };
  }
  componentDidMount() {
    fetch("http://localhost:8080/api.json")
      .then(res => res.json())
      .then(res => this.setState({ data: res }))
      .catch(err => console.log(err));
  }
  render() {
    return (
      <div className={styles.Main}>
        <h1>Database API</h1>
        <div className={styles.Container}>
          <h2>Data</h2>
          {this.state.data.map((item, i) => {
            return (
              <div key={i} className={styles.Data}>
                <ul>
                  <li>ID: {item.id}</li>
                  {/* <li>Name: {item.name</li> */}
                  {/* <li>Age: {item.age}</li> */}
                  {/* <li>Password: {item.pass}</li> */}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
}

export default App;

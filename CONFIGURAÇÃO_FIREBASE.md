Configuração do SDK
npm install firebase

Depois inicialize o Firebase e comece a usar os SDKs dos produtos.

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAWnH7kGT7D4Syu33nj53oEHe_ZE464avg",
  authDomain: "myinventoy.firebaseapp.com",
  projectId: "myinventoy",
  storageBucket: "myinventoy.firebasestorage.app",
  messagingSenderId: "220214662897",
  appId: "1:220214662897:web:2d32046886bb597bc3fb50",
  measurementId: "G-MNQ0TY8KDL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

Observação: essa opção usa o SDK modular para JavaScript, que reduz o tamanho do SDK.

Saiba mais sobre o Firebase para Web: Vamos começar, Referência da API Web SDK, Amostras

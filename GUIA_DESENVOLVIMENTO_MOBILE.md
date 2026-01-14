# Guia de Desenvolvimento - Aplicação Mobile MyInventory (React Native)

## =� Vis�o Geral

Este documento orienta o desenvolvimento da aplicação mobile MyInventory em **React Native** para execução de checklists pelos agentes em campo. A aplicação compartilha a mesma base do **Firestore** com a aplicação web.

---

## < Objetivo da Aplicação

Permitir que **agentes** executem checklists nas lojas através do aplicativo mobile, com funcionalidades de:

- Visualizar checklists disponíveis para sua loja
- Preencher checklists com diferentes tipos de perguntas
- Tirar fotos como evidência (obrigatórias ou opcionais)
- Salvar respostas online e offline
- Sincronizar dados quando houver conexão
---

## = Estrutura do Firestore

### Coleções Principais

#### 1. `checklist_templates`
Templates de checklist criados pela web.

```javascript
{
  id: "template123",
  name: "Checklist de Abertura",
  description: "Verificações diárias de abertura da loja",
  type: "opening", // opening, closing, haccp, cleaning, merchandising, maintenance, audit, custom
  frequency: "daily", // daily, weekly, monthly, per_shift, on_demand
  companyId: "empresa1",
  storeIds: ["loja1", "loja2"], // Se vazio, aplica a todas
  sectors: ["padaria", "açougue"],
  allowedUserIds: ["user1", "user2"], // Se vazio, todos têm acesso
  questions: [
    {
      id: "q_1234_0",
      order: 0,
      question: "A geladeira está limpa?",
      type: "yes_no", // yes_no, multiple_choice, numeric, text, photo, temperature, signature
      required: true,
      options: [], // Para multiple_choice
      minValue: null, // Para numeric/temperature
      maxValue: null,
      unit: null, // °C, kg, L
      photoRequired: false, // Foto obrigatória?
      allowMultiplePhotos: true, // Permite tirar fotos?
      maxPhotos: 3 // Máximo de fotos permitidas
    }
  ],
  estimatedDuration: 15, // minutos
  requiresGPS: false,
  requiresSignature: false,
  allowOfflineExecution: true,
  active: true,
  version: 1,
  createdBy: "userId",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### 2. `checklist_executions`
Execuções de checklist realizadas pelos agentes.

```javascript
{
  id: "exec123",
  templateId: "template123",
  templateName: "Checklist de Abertura",
  templateType: "opening",
  companyId: "empresa1",
  storeId: "loja1",
  storeName: "Loja Matriz",
  sector: "padaria",
  userId: "agente1",
  userName: "João Silva",
  scheduledDate: Timestamp, // Data agendada
  startedAt: Timestamp, // Quando começou
  completedAt: Timestamp, // Quando finalizou
  status: "completed", // scheduled, in_progress, completed, overdue, cancelled
  progress: 100, // 0-100
  answers: [
    {
      questionId: "q_1234_0",
      value: true, // Valor genérico
      booleanValue: true, // Para yes_no
      numericValue: null, // Para numeric/temperature
      textValue: null, // Para text
      selectedOptions: [], // Para multiple_choice
      photos: ["https://storage.../photo1.jpg"], // URLs das fotos
      signature: null, // URL da assinatura
      answeredBy: "agente1",
      answeredAt: Timestamp,
      notes: "Observação adicional"
    }
  ],
  gpsLocation: {
    latitude: -23.550520,
    longitude: -46.633308,
    accuracy: 10
  },
  finalSignature: "https://storage.../signature.jpg",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  syncedAt: Timestamp, // Última sincronização
  offlineCreated: false // Criado offline?
}
```

#### 3. `users`
Usuários do sistema (agentes, gerentes, etc).

```javascript
{
  id: "user123",
  displayName: "João Silva",
  email: "joao@exemplo.com",
  role: "agent", // developer, admin, manager, agent, buyer
  companyId: "empresa1",
  storeId: "loja1", // Loja vinculada (para agentes)
  active: true,
  createdAt: Timestamp,
  lastSeen: Timestamp,
  isOnline: false
}
```

#### 4. `stores`
Lojas do sistema.

```javascript
{
  id: "loja1",
  name: "Loja Matriz",
  companyId: "empresa1",
  managerId: "gerente1",
  address: "Rua ABC, 123",
  city: "São Paulo",
  state: "SP",
  active: true,
  createdAt: Timestamp
}
```

---

## = Fluxo de Uso da Aplicação

### 1. Login
- Usuário faz login com email/senha via Firebase Authentication
- Buscar dados do usuário na coleção `users`
- Armazenar `userId`, `storeId`, `role` localmente

### 2. Tela Inicial (Dashboard)
- Listar checklists disponíveis para o agente
- Filtros aplicados:
  - `storeIds` vazio OU contém `user.storeId`
  - `allowedUserIds` vazio OU contém `user.id`
  - `active = true`
- Mostrar cards com:
  - Nome do template
  - Tipo
  - Duração estimada
  - Botão "Iniciar"

### 3. Iniciar Checklist
Quando o agente clica em "Iniciar":

```javascript
// 1. Criar execução no Firestore
const execution = {
  templateId: template.id,
  templateName: template.name,
  templateType: template.type,
  companyId: user.companyId,
  storeId: user.storeId,
  storeName: user.storeName, // Buscar do user ou store
  userId: user.id,
  userName: user.displayName,
  scheduledDate: new Date(),
  startedAt: new Date(),
  status: 'in_progress',
  progress: 0,
  answers: [],
  createdAt: firestore.FieldValue.serverTimestamp(),
  updatedAt: firestore.FieldValue.serverTimestamp(),
  offlineCreated: !isOnline // Se estiver offline
};

const executionRef = await firestore()
  .collection('checklist_executions')
  .add(execution);

// 2. Navegar para tela de execução
navigation.navigate('ExecuteChecklist', {
  executionId: executionRef.id,
  template: template
});
```

### 4. Executar Checklist (Tela Principal)

**Layout sugerido:**
- Header: Nome do template, progresso (ex: 3/10)
- Barra de progresso visual
- Pergunta atual (uma por vez)
- Botões: "Anterior", "Próxima", "Salvar e Sair"

**Por tipo de pergunta:**

#### a) `yes_no` (Sim/Não)
```jsx
<View>
  <Text>{question.question}</Text>
  <View style={{flexDirection: 'row'}}>
    <Button
      title="Sim"
      onPress={() => handleAnswer(question.id, true)}
    />
    <Button
      title="Não"
      onPress={() => handleAnswer(question.id, false)}
    />
  </View>
  {renderPhotoSection(question)}
</View>
```

#### b) `multiple_choice` (Múltipla Escolha)
```jsx
<View>
  <Text>{question.question}</Text>
  {question.options.map(option => (
    <TouchableOpacity
      key={option}
      onPress={() => handleAnswer(question.id, option)}
    >
      <Text>{option}</Text>
    </TouchableOpacity>
  ))}
  {renderPhotoSection(question)}
</View>
```

#### c) `numeric` ou `temperature` (Numérico)
```jsx
<View>
  <Text>{question.question}</Text>
  <TextInput
    keyboardType="numeric"
    placeholder={`Entre ${question.minValue} e ${question.maxValue}`}
    onChangeText={(value) => handleAnswer(question.id, parseFloat(value))}
  />
  {question.unit && <Text>Unidade: {question.unit}</Text>}
  {renderPhotoSection(question)}
</View>
```

#### d) `text` (Texto Livre)
```jsx
<View>
  <Text>{question.question}</Text>
  <TextInput
    multiline
    numberOfLines={4}
    placeholder="Digite sua resposta..."
    onChangeText={(value) => handleAnswer(question.id, value)}
  />
  {renderPhotoSection(question)}
</View>
```

#### e) Seção de Fotos
```jsx
function renderPhotoSection(question) {
  // Se não permite fotos, não mostrar nada
  if (!question.allowMultiplePhotos && !question.photoRequired) {
    return null;
  }

  return (
    <View>
      <Text>
        {question.photoRequired ? '📷 Foto Obrigatória' : '📷 Foto Opcional'}
      </Text>
      <Text>Máximo: {question.maxPhotos || 1} foto(s)</Text>

      {/* Mostrar fotos já tiradas */}
      {photos.map((photo, index) => (
        <Image key={index} source={{ uri: photo }} />
      ))}

      {/* Botão para tirar foto */}
      {photos.length < (question.maxPhotos || 1) && (
        <Button
          title="📷 Tirar Foto"
          onPress={() => takePhoto(question.id)}
        />
      )}
    </View>
  );
}
```

### 5. Capturar Fotos

Usar biblioteca **react-native-image-picker** ou **expo-image-picker**:

```javascript
import ImagePicker from 'react-native-image-picker';

async function takePhoto(questionId) {
  const result = await ImagePicker.launchCamera({
    mediaType: 'photo',
    quality: 0.8,
    maxWidth: 1024,
    maxHeight: 1024,
  });

  if (!result.cancelled) {
    // 1. Upload para Firebase Storage
    const photoUrl = await uploadPhoto(result.uri, questionId);

    // 2. Adicionar URL às respostas
    addPhotoToAnswer(questionId, photoUrl);
  }
}

async function uploadPhoto(uri, questionId) {
  const filename = `executions/${executionId}/questions/${questionId}/${Date.now()}.jpg`;
  const storageRef = storage().ref(filename);

  await storageRef.putFile(uri);
  const downloadUrl = await storageRef.getDownloadURL();

  return downloadUrl;
}
```

### 6. Salvar Respostas

Atualizar a execução conforme o agente responde:

```javascript
async function handleAnswer(questionId, value) {
  const updatedAnswers = [...answers];

  // Procurar se já existe resposta para essa pergunta
  const existingIndex = updatedAnswers.findIndex(a => a.questionId === questionId);

  const answer = {
    questionId,
    value,
    booleanValue: typeof value === 'boolean' ? value : null,
    numericValue: typeof value === 'number' ? value : null,
    textValue: typeof value === 'string' ? value : null,
    selectedOptions: Array.isArray(value) ? value : [],
    photos: photos[questionId] || [],
    answeredBy: userId,
    answeredAt: new Date(),
    notes: notes[questionId] || ''
  };

  if (existingIndex >= 0) {
    updatedAnswers[existingIndex] = answer;
  } else {
    updatedAnswers.push(answer);
  }

  setAnswers(updatedAnswers);

  // Calcular progresso
  const progress = Math.round((updatedAnswers.length / questions.length) * 100);

  // Atualizar no Firestore
  await firestore()
    .collection('checklist_executions')
    .doc(executionId)
    .update({
      answers: updatedAnswers,
      progress,
      updatedAt: firestore.FieldValue.serverTimestamp()
    });
}
```

### 7. Finalizar Checklist

Quando todas as perguntas forem respondidas:

```javascript
async function completeChecklist() {
  // Validar perguntas obrigatórias
  const unansweredRequired = questions.filter(q =>
    q.required && !answers.find(a => a.questionId === q.id)
  );

  if (unansweredRequired.length > 0) {
    Alert.alert('Atenção', 'Há perguntas obrigatórias não respondidas');
    return;
  }

  // Validar fotos obrigatórias
  const missingPhotos = questions.filter(q => {
    if (!q.photoRequired) return false;
    const answer = answers.find(a => a.questionId === q.id);
    return !answer?.photos || answer.photos.length === 0;
  });

  if (missingPhotos.length > 0) {
    Alert.alert('Atenção', 'Há fotos obrigatórias não capturadas');
    return;
  }

  // Capturar GPS (se necessário)
  let gpsLocation = null;
  if (template.requiresGPS) {
    gpsLocation = await getCurrentLocation();
  }

  // Capturar assinatura (se necessário)
  let finalSignature = null;
  if (template.requiresSignature) {
    finalSignature = await getSignature();
  }

  // Atualizar execução como concluída
  await firestore()
    .collection('checklist_executions')
    .doc(executionId)
    .update({
      status: 'completed',
      progress: 100,
      completedAt: firestore.FieldValue.serverTimestamp(),
      gpsLocation,
      finalSignature,
      updatedAt: firestore.FieldValue.serverTimestamp()
    });

  Alert.alert('Sucesso', 'Checklist finalizado!');
  navigation.goBack();
}
```

---

## = Funcionalidade Offline

### Configuração Firestore Offline

```javascript
// No App.js ou index.js
import firestore from '@react-native-firebase/firestore';

firestore().settings({
  persistence: true, // Habilitar persistência
  cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED
});
```

### Estratégia Offline

1. **Leitura:**
   - Templates são baixados e armazenados no cache
   - Agente pode ver templates mesmo offline

2. **Escrita:**
   - Respostas são salvas localmente
   - Campo `offlineCreated: true` indica criação offline
   - Quando houver conexão, Firestore sincroniza automaticamente

3. **Fotos:**
   - Armazenar fotos localmente enquanto offline
   - Fazer upload quando houver conexão
   - Usar biblioteca como `@react-native-community/netinfo` para detectar conexão

```javascript
import NetInfo from '@react-native-community/netinfo';

const [isOnline, setIsOnline] = useState(true);

useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(state => {
    setIsOnline(state.isConnected);
  });

  return () => unsubscribe();
}, []);

// Ao fazer upload de foto
if (isOnline) {
  await uploadPhoto(photo);
} else {
  // Salvar localmente e marcar para upload posterior
  await savePhotoForLater(photo);
}
```

---

## Bibliotecas Recomendadas

```json
{
  "dependencies": {
    "@react-native-firebase/app": "^18.0.0",
    "@react-native-firebase/auth": "^18.0.0",
    "@react-native-firebase/firestore": "^18.0.0",
    "@react-native-firebase/storage": "^18.0.0",
    "@react-navigation/native": "^6.1.0",
    "@react-navigation/stack": "^6.3.0",
    "react-native-image-picker": "^5.0.0",
    "@react-native-community/netinfo": "^11.0.0",
    "react-native-geolocation-service": "^5.3.0",
    "react-native-signature-canvas": "^4.7.0",
    "react-native-vector-icons": "^10.0.0"
  }
}
```

---

## < Telas da Aplicação

### 1. Login
- Email
- Senha
- Botão "Entrar"
- Indicador de loading

### 2. Dashboard (Home)
- Lista de templates disponíveis
- Card com: Nome, Tipo, Duração, Botão "Iniciar"
- Badge mostrando checklists pendentes
- Opção "Meus Checklists" (executados)

### 3. Executar Checklist
- Header: Título, Progresso
- Pergunta atual
- Campos de resposta (variável por tipo)
- Seção de fotos (se aplicável)
- Navegação: Anterior/Próxima
- Botões: "Salvar e Sair", "Finalizar"

### 4. Histórico
- Lista de checklists executados
- Filtros: Status, Data
- Card mostrando: Template, Data, Status, Progresso
- Click para ver detalhes

### 5. Detalhes de Execu��o
- Informações do checklist
- Todas as perguntas e respostas
- Fotos capturadas
- Assinatura (se houver)
- Localização (se houver)

---

## Autenticação e Segurança
### Firebase Authentication

```javascript
import auth from '@react-native-firebase/auth';

// Login
async function signIn(email, password) {
  try {
    const userCredential = await auth().signInWithEmailAndPassword(email, password);
    const userId = userCredential.user.uid;

    // Buscar dados do usuário
    const userDoc = await firestore()
      .collection('users')
      .doc(userId)
      .get();

    const userData = userDoc.data();

    // Verificar se é agente ativo
    if (userData.role !== 'agent' || !userData.active) {
      Alert.alert('Erro', 'Acesso não autorizado');
      await auth().signOut();
      return;
    }

    // Salvar localmente
    await AsyncStorage.setItem('userId', userId);
    await AsyncStorage.setItem('storeId', userData.storeId);

    return userData;
  } catch (error) {
    Alert.alert('Erro', error.message);
  }
}

// Logout
async function signOut() {
  await auth().signOut();
  await AsyncStorage.clear();
}
```

### Regras de Segurança Firestore

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Usuários podem ler seus próprios dados
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
    }

    // Templates: agentes podem ler templates ativos da sua loja
    match /checklist_templates/{templateId} {
      allow read: if request.auth != null
        && resource.data.active == true
        && (resource.data.storeIds.size() == 0
          || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.storeId in resource.data.storeIds)
        && (resource.data.allowedUserIds.size() == 0
          || request.auth.uid in resource.data.allowedUserIds);
    }

    // Execuções: agentes podem criar e atualizar suas próprias execuções
    match /checklist_executions/{executionId} {
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.userId;

      allow update: if request.auth != null
        && request.auth.uid == resource.data.userId;

      allow read: if request.auth != null
        && request.auth.uid == resource.data.userId;
    }
  }
}
```

---

## Captura de GPS

```javascript
import Geolocation from 'react-native-geolocation-service';
import { PermissionsAndroid, Platform } from 'react-native';

async function getCurrentLocation() {
  // Solicitar permissão (Android)
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );

    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      Alert.alert('Permissão negada', 'GPS é necessário para este checklist');
      return null;
    }
  }

  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        Alert.alert('Erro GPS', error.message);
        reject(error);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  });
}
```

---

## Captura de Assinatura

```javascript
import SignatureCanvas from 'react-native-signature-canvas';

function SignatureScreen({ onSave }) {
  const handleSignature = (signature) => {
    // signature é uma base64 string
    // Fazer upload para Storage
    uploadSignature(signature);
  };

  return (
    <View style={{ flex: 1 }}>
      <SignatureCanvas
        onOK={handleSignature}
        descriptionText="Assine abaixo"
        clearText="Limpar"
        confirmText="Confirmar"
        webStyle={`.m-signature-pad { box-shadow: none; border: 1px solid #e0e0e0; }`}
      />
    </View>
  );
}

async function uploadSignature(base64) {
  const filename = `executions/${executionId}/signature_${Date.now()}.jpg`;
  const storageRef = storage().ref(filename);

  await storageRef.putString(base64, 'base64', {
    contentType: 'image/jpeg'
  });

  const url = await storageRef.getDownloadURL();
  return url;
}
```

---

## Testes Recomendados

### Cenários de Teste

1. **Login:**
   - Login com credenciais válidas
   - Login com credenciais inválidas
   - Logout

2. **Listar Templates:**
   - Ver apenas templates da loja do agente
   - Ver apenas templates ativos
   - Respeitar `allowedUserIds`

3. **Executar Checklist:**
   - Responder todos os tipos de pergunta
   - Validar campos obrigatórios
   - Tirar fotos obrigatórias
   - Tirar fotos opcionais
   - Limitar quantidade de fotos
   - Capturar GPS (se necessário)
   - Capturar assinatura (se necessário)

4. **Offline:**
   - Iniciar checklist offline
   - Preencher respostas offline
   - Sincronizar quando online
   - Upload de fotos pendentes

5. **Validações:**
   - Impedir finalizar sem perguntas obrigatórias
   - Impedir finalizar sem fotos obrigatórias
   - Validar valores mín/máx em numéricos

---

## Exemplo de Código Completo
```javascript
// ExecuteChecklistScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, Button, Alert, ScrollView } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useRoute, useNavigation } from '@react-navigation/native';

export default function ExecuteChecklistScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { executionId, template } = route.params;

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [photos, setPhotos] = useState({});

  const currentQuestion = template.questions[currentQuestionIndex];

  async function handleAnswer(questionId, value) {
    const newAnswers = [...answers];
    const existingIndex = newAnswers.findIndex(a => a.questionId === questionId);

    const answer = {
      questionId,
      value,
      booleanValue: typeof value === 'boolean' ? value : null,
      numericValue: typeof value === 'number' ? value : null,
      textValue: typeof value === 'string' ? value : null,
      photos: photos[questionId] || [],
      answeredBy: auth().currentUser.uid,
      answeredAt: new Date()
    };

    if (existingIndex >= 0) {
      newAnswers[existingIndex] = answer;
    } else {
      newAnswers.push(answer);
    }

    setAnswers(newAnswers);

    const progress = Math.round((newAnswers.length / template.questions.length) * 100);

    await firestore()
      .collection('checklist_executions')
      .doc(executionId)
      .update({
        answers: newAnswers,
        progress,
        updatedAt: firestore.FieldValue.serverTimestamp()
      });
  }

  function renderQuestion() {
    if (currentQuestion.type === 'yes_no') {
      return (
        <View>
          <Text style={{ fontSize: 18, marginBottom: 20 }}>
            {currentQuestion.question}
          </Text>
          <Button title="Sim" onPress={() => handleAnswer(currentQuestion.id, true)} />
          <Button title="Não" onPress={() => handleAnswer(currentQuestion.id, false)} />
        </View>
      );
    }

    // Implementar outros tipos...
  }

  return (
    <ScrollView style={{ padding: 20 }}>
      <Text>Progresso: {currentQuestionIndex + 1} / {template.questions.length}</Text>

      {renderQuestion()}

      <View style={{ flexDirection: 'row', marginTop: 20 }}>
        {currentQuestionIndex > 0 && (
          <Button
            title="Anterior"
            onPress={() => setCurrentQuestionIndex(currentQuestionIndex - 1)}
          />
        )}

        {currentQuestionIndex < template.questions.length - 1 ? (
          <Button
            title="Próxima"
            onPress={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
          />
        ) : (
          <Button
            title="Finalizar"
            onPress={completeChecklist}
          />
        )}
      </View>
    </ScrollView>
  );
}
```

---

## Próximos Passos

1. Configurar Firebase no projeto React Native
2. Implementar autenticação
3. Criar telas principais (Login, Dashboard, Executar)
4. Implementar lógica de cada tipo de pergunta
5. Adicionar captura de fotos
6. Implementar GPS e assinatura
7. Testar modo offline
8. Adicionar validações
9. Testes em dispositivos reais
10. Publicar na Play Store / App Store

---

## Suporte

Para dúvidas sobre a estrutura do Firestore ou integração com a web, entre em contato com a equipe de desenvolvimento web.

**Documentação Firebase:**
- React Native Firebase: https://rnfirebase.io/
- Firestore: https://firebase.google.com/docs/firestore
- Storage: https://firebase.google.com/docs/storage

---

**Versão:** 1.0
**Data:** Dezembro 2025
**Autor:** Equipe MyInventory

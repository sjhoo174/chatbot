import { configureStore, createSlice } from '@reduxjs/toolkit';
import { MessageType } from './types';

// Define the initial state
const initialChatsState = {
    chats: [] as MessageType[],
  };

  

// Create a slice of the store (actions + reducer)
const chatsSlice = createSlice({
    name: 'chats',
    initialState: initialChatsState,
    reducers: {
        setChats: (state, action) => {
        state.chats = action.payload
        }
    },
});


export const { setChats } = chatsSlice.actions;


const initialLoginState = {
    status: false,
    email: "",
}

// Create a slice of the store (actions + reducer)
const loginSlice = createSlice({
    name: 'login',
    initialState: initialLoginState,
    reducers: {
        setLogin: (state, action) => {
            state.status = action.payload
        },
        setEmail: (state, action) => {
            state.email = action.payload
        }
    },
});

export const {setLogin, setEmail} = loginSlice.actions

  
// Create the Redux store with configureStore
const store = configureStore({
    reducer: {
        chats: chatsSlice.reducer,
        login: loginSlice.reducer
    },
});
  
export default store;
import React,{
    useState,
    useEffect
  } from 'react';
import "./login.scss" 
import {getQueryParam, removeQueryParam } from '../utils/auth';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setChats, setEmail } from '../store';
import { handleResize, useLayout } from '../hooks/useLayout';
import { fetchConversations, getEmail } from '../data/api';

// Simulate loading progress
export default function Login() {
    const [spinner, setSpinner] = useState(false)
    const navigate = useNavigate()
    const dispatch = useDispatch()

    const handleLogin = async (count) => {
        setSpinner(true)
        if (count > 3) return
        await fetch(`${import.meta.env.VITE_API_URL}/login`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', // This ensures cookies are sent and received
        }).then((response) => {
            return response.json()
        }).then((data) => {
            setSpinner(false)
            window.location.href = data 
        }).catch((error) => {
            count += 1
            if (count > 3) return
            setTimeout(() => handleLogin(count), 200)
        })
    }

    
    useEffect(() => {
        setSpinner(false)
        useLayout()
        
        window.addEventListener("resize", handleResize)
        localStorage.removeItem("TOKEN")
        const token = getQueryParam('token');
        if (token) {
            localStorage.setItem("TOKEN", token)
            removeQueryParam("token");
            getEmail().then((data) => {
                dispatch(setEmail(data["email"]))
            }).then(() => {
                setTimeout(() => { 
                    navigate("/app")
                },1000)
            }).catch((error) => {
                console.log(error)
                navigate("/")
            })
            
            return
        } 
        return () => {
            window.removeEventListener("resize", handleResize)
            console.log("login unmounted")
        }
    }, []);

    
    return (
        <div className="login">
            <div className='title'>SJ Chatbot</div>
            {<button className='gmail' onClick={() => handleLogin(0)}>
                Sign in with gmail
                {spinner && <div className="spinner"></div>}
            </button>}
        </div>
    )
}

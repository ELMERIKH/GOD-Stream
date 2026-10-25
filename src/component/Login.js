import React, { useContext } from 'react'
import { useForm } from 'react-hook-form'
import axios from 'axios'
import { AuthicateContext } from './Auth'
import { useNavigate,Link } from 'react-router-dom'
import './style.css';
const api = axios.create({
    baseURL : "http://localhost:9000/api/auth"
})

function Auth() {
   
    const {register, handleSubmit} = useForm()
    const [authInfo, setAuthInfo] = useContext(AuthicateContext)
    const navigate = useNavigate()
   
    const submitFormAuth = (data)=>{
        try{   api.post('/login',{
            "email":data.email,
            "password":data.password
        })
        .then(rep=>{ 
            console.log(authInfo) 
            console.log('rep.data:', rep.data);
            console.log('rep.data.email:',data.email);
          
            setAuthInfo(()=>({token:rep.data,isAuthenticated:true}))
            localStorage.setItem('token', rep.data.token);
        localStorage.setItem('email',data.email);
                alert("loggeDIn")
                navigate('/Create')
            })}
            catch (err) {
   
                alert("user not found");
              }
    }

    return (
        <div className="auth-screen">
            <h1 className='test-success'>Login to rate your favourite Movies</h1>
            <form className="panel-form" onSubmit={handleSubmit(submitFormAuth)}>
                <div className='form-group'>
                    <label>Email</label>
                    <input {...register('email')} type="email" className='form-control' />
                </div>
                <div className='form-group'>
                    <label>Password</label>
                    <input {...register('password')} type="password" className='form-control' />
                </div>
                <button  type="submit" className='LOG'>Login</button>
                <div>
                <button>
                <Link to="/register" className='R'>Register</Link>
               
              </button>
              </div>
            </form>

        </div>
    )
}

export default Auth
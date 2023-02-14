import React, { useState ,useEffect,createContext} from "react";
import axios from "axios";
export const AuthicateContext =createContext(null) ;
export const AuthProvider =(props)=>{
const[authInfo,setAuthInfo]=useState({token:'',isAuthenticated:false})
useEffect(() => { if(authInfo.isAuthenticated===true)
  axios.defaults.headers.common['Authorization'] = `Bearer ${authInfo.token}`;
}, [authInfo.token]);
return(
  <AuthicateContext.Provider value ={[authInfo,setAuthInfo]}>
    {props.children}
  </AuthicateContext.Provider>
)}

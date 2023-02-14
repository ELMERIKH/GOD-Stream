import React from "react";
import { useContext } from 'react';
import { AuthicateContext } from "./Auth";

import { Navigate,Outlet } from "react-router-dom";    
  
const Protected = () => {
  const [authInfo, setAuthInfo] = useContext(AuthicateContext);
 


      return(authInfo.isAuthenticated)?<Outlet/>:<Navigate to='/login'/>
    
      
}

  export default Protected;
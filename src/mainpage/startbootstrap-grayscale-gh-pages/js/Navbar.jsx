// Navbar.js
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import mainpage_logo from '../../../signin_page/GST_logo.png'

const Navbar = ({ signup, login }) => {
  const [isShrinked, setIsShrinked] = useState(false);



  useEffect(() => {
    const checkIfShrinked = () => {
      if (window.scrollY === 0) {
        setIsShrinked(false);
      } else {
        setIsShrinked(true);
      }
    };

    checkIfShrinked();
    document.addEventListener('scroll', checkIfShrinked);

    return () => {
      document.removeEventListener('scroll', checkIfShrinked);
    };
  }, []);

  return (
    <nav className={`navbar navbar-expand-lg navbar-light fixed-top ${isShrinked ? 'navbar-shrink' : ''}`} id="mainNav" style={{ width: '100%' }}>
      <div className="container-fluid px-4 px-lg-5">
        <Link className="navbar-brand" to="#page-top">
          <img id="mainpage_logo" src={mainpage_logo} alt="Logo" />
        </Link>
        <button
          className="navbar-toggler navbar-toggler-right"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarResponsive"
          aria-controls="navbarResponsive"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          Menu <i className="fas fa-bars"></i>
        </button>
        <div className="collapse navbar-collapse" id="navbarResponsive">
          <ul className="navbar-nav ms-auto">
            <li className="nav-item">
              <a className="nav-link" href="#about">
                About
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link" href="#projects">
                Projects
              </a>
            </li>
            <li className="nav-item">
              <Link to="/Signup" className="nav-link" onClick={signup}>
                <span className="link-text">Join</span>
              </Link>
            </li>
            <li className="nav-item">
              <Link to="/SignIn" className="nav-link" onClick={login}>
                <span className="link-text">Login</span>
              </Link>
            </li>
            <li className="nav-item">
              <Link to="/calendar" className="nav-link">
                <button className="btn btn-primary"><span id="top_btn">GST Start</span></button>
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};


export default Navbar;
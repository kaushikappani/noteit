const containerStyle = {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    background: 'linear-gradient(45deg, #1BA1E3, #5684D1, #9168C0)', 
    animation: 'backgroundAnimation 10s ease infinite', 
    overflow: 'hidden',
    opacity: 0.5
};

const svgStyle = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000, 
    width: '50px',
    height: '50px',
};

// Glitter effect keyframes
const glitterKeyframes = `
    @keyframes glitter {
        0% { opacity: 0.5; transform: translateY(0) rotate(0deg); }
        50% { opacity: 1; transform: translateY(-20px) rotate(180deg); }
        100% { opacity: 0.5; transform: translateY(0) rotate(360deg); }
    }

    @keyframes backgroundAnimation {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
    }
`;

// Glitter particles
const glitterParticles = Array.from({ length: 100 }).map((_, index) => ({
    width: '5px',
    height: '5px',
    backgroundColor: 'white',
    opacity: '0.5',
    position: 'absolute',
    borderRadius: '50%',
    animation: `glitter 2s linear infinite`,
    top: `${Math.random() * 100}vh`,
    left: `${Math.random() * 100}vw`,
    animationDelay: `${Math.random() * 2}s`,
}));

const BlinkingStyle = () => {
    return (
        <style>
            {glitterKeyframes}
        </style>
    );
};

const GlitterParticles = () => {
    return glitterParticles.map((style, index) => (
        <div key={index} style={style}></div>
    ));
};

const GeminiLogo = ({ aiLoading }) => {
    if (aiLoading) {
        return (
            <>
                <BlinkingStyle />
                <div style={containerStyle}>
                    <GlitterParticles />
                    <svg style={svgStyle} fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 5">
                        <path d="M5 2.51A2.505 2.505 0 002.51 5h-.032A2.505 2.505 0 000 2.51v-.032A2.505 2.505 0 002.484 0h.032A2.505 2.505 0 005 2.484v.032z" fill="url(#prefix__paint0_radial_980_20147)" />
                        <defs>
                            <radialGradient id="prefix__paint0_radial_980_20147" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="matrix(5.0331 1.6887 -13.5418 39.6161 0.794 1.875)"><stop offset=".067" stopColor="#9168C0" /><stop offset=".343" stopColor="#5684D1" /><stop offset=".672" stopColor="#1BA1E3" /></radialGradient>
                        </defs>
                    </svg>
                </div>
            </>
        );
    } else {
        return null;
    }
};

export default GeminiLogo;
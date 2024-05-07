import React, { useState } from 'react';

const ProfilePic = ({ user, handleImageChange }) => {
    const [showInput, setShowInput] = useState(false);

 

    return (
        <div>
            {user.pic ? (
                <img
                    src={user.pic}
                    alt="Profile"
                    style={{ width: '250px', cursor: 'pointer'}}
                    onClick={handleImageChange}
                />
            ) : (
                <input
                    id="profileImage"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: 'none' }}
                />
            )}
            {!user.pic && (
                <button onClick={() => setShowInput(true)} style={{ cursor: 'pointer' }}>
                    Upload Picture
                </button>
            )}
            {showInput && (
                <input
                    id="profileImage"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: 'block' }}
                />
            )}
        </div>
    );
};

export default ProfilePic;

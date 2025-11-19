// Simple in-memory store for tracking online users
const onlineUsers = new Map();

// Add user to online list
const addOnlineUser = (userId, userInfo) => {
  onlineUsers.set(userId, {
    ...userInfo,
    lastSeen: new Date()
  });
};

// Remove user from online list
const removeOnlineUser = (userId) => {
  onlineUsers.delete(userId);
};

// Update user's last seen time
const updateUserActivity = (userId) => {
  const user = onlineUsers.get(userId);
  if (user) {
    user.lastSeen = new Date();
    onlineUsers.set(userId, user);
  }
};

// Get all online users
const getOnlineUsers = () => {
  const now = new Date();
  const onlineUserIds = [];
  
  // Clean up users who haven't been active for more than 5 minutes
  for (const [userId, userInfo] of onlineUsers.entries()) {
    const timeDiff = now - userInfo.lastSeen;
    if (timeDiff > 5 * 60 * 1000) { // 5 minutes
      onlineUsers.delete(userId);
    } else {
      onlineUserIds.push(userId);
    }
  }
  
  return onlineUserIds;
};

// Check if user is online
const isUserOnline = (userId) => {
  return onlineUsers.has(userId);
};

module.exports = {
  addOnlineUser,
  removeOnlineUser,
  updateUserActivity,
  getOnlineUsers,
  isUserOnline
}; 
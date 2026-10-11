/**
 * User ID Debugging Script
 * Run this in browser console to check current user state
 */

// Check what's in localStorage
console.log("=== LOCAL STORAGE ===");
const currentUserId = localStorage.getItem("current_user_id");
console.log("Current User ID:", currentUserId);

const users = localStorage.getItem("fitness_users");
if (users) {
    const parsedUsers = JSON.parse(users);
    console.log("All users in localStorage:", parsedUsers);
    console.log("Number of users:", parsedUsers.length);
} else {
    console.log("No users found in localStorage");
}

// Check chat history
const chatHistory = localStorage.getItem(`chat_history_${currentUserId}`);
if (chatHistory) {
    const parsed = JSON.parse(chatHistory);
    console.log(`Chat history for ${currentUserId}:`, parsed.length, "messages");
} else {
    console.log(`No chat history for ${currentUserId}`);
}

console.log("\n=== INSTRUCTIONS ===");
console.log("1. Copy the 'Current User ID' value above");
console.log("2. Check if this ID matches the userId in your MongoDB user_plans collection");
console.log("3. If they don't match, you have two options:");
console.log("   a. Update the plan in MongoDB to use the current user ID");
console.log("   b. Login with the account that matches the plan's userId");

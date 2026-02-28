// 🟢 SNIPER: Send to exactly ONE user (Student or Vendor)
export async function notifyUser(userId: string, title: string, body: string) {
  const ONESIGNAL_APP_ID = "0e65c351-3716-44e5-8c20-d588d38a54de"; 
  
  // 👇 FIXED: Removed the accidental 'Y' at the end of this key!
  const ONESIGNAL_API_KEY = "os_v2_app_bzs4gujxczcoldba2wenhcsu3yzu4yzszmletdvdd3wrloi2mjjtefagrcvgf7eiriuakegnhebqgxeok54pfzjzegtokbz2dik2gny";    

  try {
      // 👇 FIXED: Using the official v1 API endpoint
      const response = await fetch('https://onesignal.com/api/v1/notifications', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              // 👇 FIXED: Changed 'Key' to 'Basic'
              'Authorization': `Basic ${ONESIGNAL_API_KEY}` 
          },
          body: JSON.stringify({
              app_id: ONESIGNAL_APP_ID,
              target_channel: "push",
              include_aliases: { "external_id": [userId] }, 
              headings: { "en": title },
              contents: { "en": body }
          })
      });
      
      const data = await response.json();
      console.log("OneSignal Sniper Response:", data);
  } catch (err) {
      console.error("Failed to send push via OneSignal:", err);
  }
}

// 🟢 SHOTGUN: Send to EVERYONE on the campus (Errands & Tutors)
export async function notifyAll(title: string, body: string) {
  const ONESIGNAL_APP_ID = "0e65c351-3716-44e5-8c20-d588d38a54de"; 
  const ONESIGNAL_API_KEY = "os_v2_app_bzs4gujxczcoldba2wenhcsu3yzu4yzszmletdvdd3wrloi2mjjtefagrcvgf7eiriuakegnhebqgxeok54pfzjzegtokbz2dik2gny";    

  try {
      const response = await fetch('https://onesignal.com/api/v1/notifications', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${ONESIGNAL_API_KEY}`
          },
          body: JSON.stringify({
              app_id: ONESIGNAL_APP_ID,
              target_channel: "push",
              included_segments: ["Subscribed Users"], 
              headings: { "en": title },
              contents: { "en": body }
          })
      });
      
      const data = await response.json();
      console.log("OneSignal Shotgun Response:", data);
  } catch (err) {
      console.error("Failed to send broadcast push via OneSignal:", err);
  }
}
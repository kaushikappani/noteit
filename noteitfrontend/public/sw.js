self.addEventListener('push', function (event) {

    console.log(event.data.json());
    const data = event.data.json();
    const url = data.data.url || "/";

    const options = {
        body: data.body,
        icon: '/icon512_maskable.png', // Path to the notification icon
        badge: '/icon512_maskable.png', // Path to the badge icon
        data: {
            url: url || "/",
        },
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', function (event) {
    const action = event.action;

    if (action === 'accept') {
        console.log('User accepted the notification');
        // You can navigate the user to a URL or perform another action
        event.notification.close();
        // Optionally navigate to the URL or take other actions
        clients.openWindow(event.notification.data.url); // This opens the URL in a new tab
    } else if (action === 'decline') {
        console.log('User declined the notification');
        event.notification.close();
        // Handle decline logic
    } else {
        // In case of a click without an action
        event.notification.close();
    }
});


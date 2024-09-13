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
    console.log(event);
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url || "/")
    );
});

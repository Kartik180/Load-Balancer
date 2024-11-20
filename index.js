const http = require('http');
const https = require('https');
const backends = [
    { url: 'https://backend-1-cr8v.onrender.com', healthy: true },
    { url: 'https://backend2-l1hz.onrender.com', healthy: true },
];
let current = 0;
const healthCheckInterval = 10000;
function performHealthChecks() {
    backends.forEach((backend, index) => {
        const targetUrl = new URL(backend.url);
        const protocol = targetUrl.protocol === 'https:' ? https : http;

        const req = protocol.request(
            {
                hostname: targetUrl.hostname,
                port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
                path: '/health',
                method: 'GET',
                timeout: 5000,
            },
            (res) => {
                backend.healthy = res.statusCode === 200; 
            }
        );

        req.on('error', () => {
            backend.healthy = false;
        });

        req.end();
    });
}
setInterval(performHealthChecks, healthCheckInterval);
const server = http.createServer((req, res) => {
    const healthyBackends = backends.filter((backend) => backend.healthy);
    if (healthyBackends.length === 0) {
        res.statusCode = 503;
        res.end('Service Unavailable');
        return;
    }
    const targetUrl = new URL(healthyBackends[current % healthyBackends.length].url);
    const proxy = (targetUrl.protocol === 'https:' ? https : http).request(
        {
            hostname: targetUrl.hostname,
            port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
            path: req.url,
            method: req.method,
            headers: req.headers,
        },
        (backendRes) => {
            res.writeHead(backendRes.statusCode, backendRes.headers);
            backendRes.pipe(res);
        }
    );
    req.pipe(proxy);
    proxy.on('error', (err) => {
        console.error('Error in proxy request:', err.message);
        res.statusCode = 502;
        res.end('Bad Gateway');
    });

    current++;
});

server.listen(8080, () => {
    console.log('HTTPS Load balancer with health checks running on port 8080');
});

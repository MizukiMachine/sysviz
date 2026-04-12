import * as THREE from 'three';

/**
 * Flask Data Flow - Based on 03_data_flow.mmd
 * Generated from /architecture-diagram-generator analysis
 *
 * Layout: U-shape
 *   Forward path (request)  z=0  left→right
 *   Return path (response)  z=7  right→left
 *   Error branch            z=-4 behind ViewFunc
 */

export const DATA_FLOW_CAMERA = {
    position: [0, 20, 28],
    target: [0, 0, 3.5]
};

export const DATA_FLOW_NODES = [
    // Forward path (request, z=0)
    {
        id: 'client',
        name: 'Client',
        type: 'browser',
        shape: 'sphere',
        status: 'idle',
        color: 0x6C9BD2,
        x: -21, y: 0, z: 0,
        dataIn: 'User action',
        dataOut: 'HTTP Request (GET /hello)',
        floatOffset: 0.0,
        glowOffset: 0.3
    },
    {
        id: 'wsgi-call',
        name: 'WSGI Entry',
        type: 'server',
        shape: 'cylinder',
        status: 'idle',
        color: 0x7BC67E,
        x: -14, y: 0, z: 0,
        dataIn: 'HTTP Request',
        dataOut: 'environ, start_response',
        floatOffset: 0.5,
        glowOffset: 0.8
    },
    {
        id: 'push-ctx',
        name: 'Context Push',
        type: 'application',
        shape: 'diamond',
        status: 'idle',
        color: 0x7BC7C4,
        x: -7, y: 0, z: 0,
        dataIn: 'Flask app',
        dataOut: 'ctx.request, ctx.g',
        floatOffset: 1.0,
        glowOffset: 1.3
    },
    {
        id: 'bind-req',
        name: 'Bind Request',
        type: 'application',
        shape: 'default',
        status: 'idle',
        color: 0x7BC7C4,
        x: 0, y: 0, z: 0,
        dataIn: 'Context',
        dataOut: 'LocalProxy bindings',
        floatOffset: 1.5,
        glowOffset: 1.8
    },
    {
        id: 'before-req',
        name: 'before_request',
        type: 'application',
        shape: 'default',
        status: 'idle',
        color: 0xD4A76A,
        x: 7, y: 0, z: 0,
        dataIn: 'Request',
        dataOut: 'Request or Response',
        floatOffset: 2.0,
        glowOffset: 2.3
    },
    {
        id: 'url-match',
        name: 'URL Router',
        type: 'application',
        shape: 'diamond',
        status: 'idle',
        color: 0xD4A76A,
        x: 14, y: 0, z: 0,
        dataIn: 'path + method',
        dataOut: 'endpoint + view_args',
        floatOffset: 2.5,
        glowOffset: 2.8
    },
    {
        id: 'view-func',
        name: 'View Function',
        type: 'application',
        shape: 'default',
        status: 'idle',
        color: 0xC77DBA,
        x: 21, y: 0, z: 0,
        dataIn: 'view_args',
        dataOut: 'Response data',
        floatOffset: 3.0,
        glowOffset: 3.3
    },
    // Error branch (z=-4)
    {
        id: 'error-handler',
        name: 'Error Handler',
        type: 'application',
        shape: 'default',
        status: 'idle',
        color: 0xD4826A,
        x: 21, y: 0, z: -4,
        dataIn: 'Exception',
        dataOut: 'Error Response',
        floatOffset: 3.5,
        glowOffset: 3.8
    },
    // Return path (response, z=7)
    {
        id: 'make-res',
        name: 'Response Build',
        type: 'application',
        shape: 'default',
        status: 'idle',
        color: 0x8BD49E,
        x: 14, y: 0, z: 7,
        dataIn: 'Data / Dict',
        dataOut: 'Response object',
        floatOffset: 4.0,
        glowOffset: 4.3
    },
    {
        id: 'after-req',
        name: 'after_request',
        type: 'application',
        shape: 'default',
        status: 'idle',
        color: 0x8BD49E,
        x: 7, y: 0, z: 7,
        dataIn: 'Response',
        dataOut: 'Modified Response',
        floatOffset: 4.5,
        glowOffset: 4.8
    },
    {
        id: 'session-save',
        name: 'Session Save',
        type: 'application',
        shape: 'cylinder',
        status: 'idle',
        color: 0x8BD49E,
        x: 0, y: 0, z: 7,
        dataIn: 'Session dict',
        dataOut: 'Set-Cookie header',
        floatOffset: 5.0,
        glowOffset: 5.3
    },
    {
        id: 'teardown',
        name: 'teardown',
        type: 'application',
        shape: 'default',
        status: 'idle',
        color: 0x9AABB8,
        x: -7, y: 0, z: 7,
        dataIn: 'Response',
        dataOut: 'Cleanup done',
        floatOffset: 5.5,
        glowOffset: 5.8
    },
    {
        id: 'pop-ctx',
        name: 'Context Pop',
        type: 'application',
        shape: 'default',
        status: 'idle',
        color: 0x9AABB8,
        x: -14, y: 0, z: 7,
        dataIn: 'AppContext',
        dataOut: '-',
        floatOffset: 6.0,
        glowOffset: 6.3
    },
    {
        id: 'http-resp',
        name: 'HTTP Response',
        type: 'browser',
        shape: 'sphere',
        status: 'idle',
        color: 0x6C9BD2,
        x: -21, y: 0, z: 7,
        dataIn: 'status + headers + body',
        dataOut: 'Rendered page',
        floatOffset: 6.5,
        glowOffset: 6.8
    }
];

export const DATA_FLOW_CONNECTIONS = [
    // Forward path
    { id: 'conn-client-wsgi', sourceId: 'client', targetId: 'wsgi-call', type: 'network', trafficVolume: 2 },
    { id: 'conn-wsgi-push', sourceId: 'wsgi-call', targetId: 'push-ctx', type: 'sync', trafficVolume: 2 },
    { id: 'conn-push-bind', sourceId: 'push-ctx', targetId: 'bind-req', type: 'sync', trafficVolume: 2 },
    { id: 'conn-bind-before', sourceId: 'bind-req', targetId: 'before-req', type: 'sync', trafficVolume: 2 },
    { id: 'conn-before-url', sourceId: 'before-req', targetId: 'url-match', type: 'sync', trafficVolume: 2 },
    { id: 'conn-url-view', sourceId: 'url-match', targetId: 'view-func', type: 'sync', trafficVolume: 2 },
    // Error branch
    { id: 'conn-view-error', sourceId: 'view-func', targetId: 'error-handler', type: 'signal', trafficVolume: 1 },
    { id: 'conn-error-res', sourceId: 'error-handler', targetId: 'make-res', type: 'sync', trafficVolume: 1 },
    // Return path
    { id: 'conn-view-res', sourceId: 'view-func', targetId: 'make-res', type: 'sync', trafficVolume: 2 },
    { id: 'conn-res-after', sourceId: 'make-res', targetId: 'after-req', type: 'sync', trafficVolume: 2 },
    { id: 'conn-after-session', sourceId: 'after-req', targetId: 'session-save', type: 'sync', trafficVolume: 2 },
    { id: 'conn-session-tdown', sourceId: 'session-save', targetId: 'teardown', type: 'sync', trafficVolume: 2 },
    { id: 'conn-tdown-pop', sourceId: 'teardown', targetId: 'pop-ctx', type: 'sync', trafficVolume: 2 },
    { id: 'conn-pop-resp', sourceId: 'pop-ctx', targetId: 'http-resp', type: 'network', trafficVolume: 2 }
];

export const DATA_FLOW_TIMELINE = {
    duration: 55,
    keyframes: [
        // 1. Client
        { time: 0.0, type: 'resource', id: 'client', status: 'active', caption: '\u30d6\u30e9\u30a6\u30b6\u304b\u3089HTTP\u30ea\u30af\u30a8\u30b9\u30c8\u300cGET /hello\u300d\u3092\u9001\u4fe1\u3057\u307e\u3059' },
        { time: 1.5, type: 'route', id: 'route-conn-client-wsgi', active: true },
        { time: 4.0, type: 'route', id: 'route-conn-client-wsgi', active: false },
        // 2. WSGI Entry
        { time: 4.5, type: 'resource', id: 'wsgi-call', status: 'active', caption: 'Flask.__call__() \u304cWSGI\u30a8\u30f3\u30c8\u30ea\u30dd\u30a4\u30f3\u30c8\u3068\u3057\u3066\u52d5\u4f5c\u3057\u307e\u3059' },
        { time: 4.5, type: 'resource', id: 'client', status: 'complete' },
        { time: 6.0, type: 'route', id: 'route-conn-wsgi-push', active: true },
        { time: 8.5, type: 'route', id: 'route-conn-wsgi-push', active: false },
        // 3. Context Push
        { time: 9.0, type: 'resource', id: 'push-ctx', status: 'active', caption: 'AppContext\u3092\u4f5c\u6210\u3057\u3001request/session/g\u3092\u5229\u7528\u53ef\u80fd\u306b\u3057\u307e\u3059' },
        { time: 9.0, type: 'resource', id: 'wsgi-call', status: 'complete' },
        { time: 10.5, type: 'route', id: 'route-conn-push-bind', active: true },
        { time: 13.0, type: 'route', id: 'route-conn-push-bind', active: false },
        // 4. Bind Request
        { time: 13.5, type: 'resource', id: 'bind-req', status: 'active', caption: 'LocalProxy\u7d4c\u7531\u3067request\u30fbsession\u30fbg\u30aa\u30d6\u30b8\u30a7\u30af\u30c8\u3092\u30d0\u30a4\u30f3\u30c9\u3057\u307e\u3059' },
        { time: 13.5, type: 'resource', id: 'push-ctx', status: 'complete' },
        { time: 15.0, type: 'route', id: 'route-conn-bind-before', active: true },
        { time: 17.5, type: 'route', id: 'route-conn-bind-before', active: false },
        // 5. before_request
        { time: 18.0, type: 'resource', id: 'before-req', status: 'active', caption: 'before_request\u30d5\u30c3\u30af\u3092\u5b9f\u884c\u3057\u307e\u3059\uff08\u8a8d\u8a3c\u30fb\u30ed\u30b0\u306a\u3069\uff09' },
        { time: 18.0, type: 'resource', id: 'bind-req', status: 'complete' },
        { time: 19.5, type: 'route', id: 'route-conn-before-url', active: true },
        { time: 22.0, type: 'route', id: 'route-conn-before-url', active: false },
        // 6. URL Router
        { time: 22.5, type: 'resource', id: 'url-match', status: 'active', caption: 'url_map.match() \u3067\u30a8\u30f3\u30c9\u30dd\u30a4\u30f3\u30c8\u3092\u7279\u5b9a\u3057\u307e\u3059' },
        { time: 22.5, type: 'resource', id: 'before-req', status: 'complete' },
        { time: 24.0, type: 'route', id: 'route-conn-url-view', active: true },
        { time: 26.5, type: 'route', id: 'route-conn-url-view', active: false },
        // 7. View Function
        { time: 27.0, type: 'resource', id: 'view-func', status: 'active', caption: '\u30d3\u30e5\u30fc\u95a2\u6570\u3092\u5b9f\u884c\u3057\u3001\u30d3\u30b8\u30cd\u30b9\u30ed\u30b8\u30c3\u30af\u3092\u51e6\u7406\u3057\u307e\u3059' },
        { time: 27.0, type: 'resource', id: 'url-match', status: 'complete' },
        { time: 28.5, type: 'route', id: 'route-conn-view-res', active: true },
        { time: 31.0, type: 'route', id: 'route-conn-view-res', active: false },
        // 8. Response Build
        { time: 31.5, type: 'resource', id: 'make-res', status: 'active', caption: '\u30ec\u30b9\u30dd\u30f3\u30b9\u30aa\u30d6\u30b8\u30a7\u30af\u30c8\u3092\u69cb\u7bc9\u3057\u307e\u3059' },
        { time: 31.5, type: 'resource', id: 'view-func', status: 'complete' },
        { time: 33.0, type: 'route', id: 'route-conn-res-after', active: true },
        { time: 35.5, type: 'route', id: 'route-conn-res-after', active: false },
        // 9. after_request
        { time: 36.0, type: 'resource', id: 'after-req', status: 'active', caption: 'after_request\u30d5\u30c3\u30af\u3067\u30ec\u30b9\u30dd\u30f3\u30b9\u3092\u4fee\u6b63\u3057\u307e\u3059' },
        { time: 36.0, type: 'resource', id: 'make-res', status: 'complete' },
        { time: 37.5, type: 'route', id: 'route-conn-after-session', active: true },
        { time: 40.0, type: 'route', id: 'route-conn-after-session', active: false },
        // 10. Session Save
        { time: 40.5, type: 'resource', id: 'session-save', status: 'active', caption: '\u30bb\u30c3\u30b7\u30e7\u30f3\u30c7\u30fc\u30bf\u3092Cookie\u306b\u4fdd\u5b58\u3057\u307e\u3059' },
        { time: 40.5, type: 'resource', id: 'after-req', status: 'complete' },
        { time: 42.0, type: 'route', id: 'route-conn-session-tdown', active: true },
        { time: 44.0, type: 'route', id: 'route-conn-session-tdown', active: false },
        // 11. teardown
        { time: 44.5, type: 'resource', id: 'teardown', status: 'active', caption: 'teardown_request\u30d5\u30c3\u30af\u3067\u30ea\u30bd\u30fc\u30b9\u3092\u30af\u30ea\u30fc\u30f3\u30a2\u30c3\u30d7\u3057\u307e\u3059' },
        { time: 44.5, type: 'resource', id: 'session-save', status: 'complete' },
        // 12. Context Pop + HTTP Response (rapid finish)
        { time: 46.0, type: 'route', id: 'route-conn-tdown-pop', active: true },
        { time: 48.0, type: 'route', id: 'route-conn-tdown-pop', active: false },
        { time: 48.5, type: 'resource', id: 'pop-ctx', status: 'active', caption: 'AppContext\u3092\u7834\u68c4\u3057\u3001HTTP\u30ec\u30b9\u30dd\u30f3\u30b9\u3092\u8fd4\u5374\u3057\u307e\u3059' },
        { time: 48.5, type: 'resource', id: 'teardown', status: 'complete' },
        { time: 49.5, type: 'route', id: 'route-conn-pop-resp', active: true },
        { time: 52.0, type: 'route', id: 'route-conn-pop-resp', active: false },
        { time: 52.5, type: 'resource', id: 'http-resp', status: 'active', caption: 'HTTP\u30ec\u30b9\u30dd\u30f3\u30b9 (200 OK) \u3092\u30d6\u30e9\u30a6\u30b6\u306b\u8fd4\u3057\u307e\u3059' },
        { time: 52.5, type: 'resource', id: 'pop-ctx', status: 'complete' }
    ]
};

export function buildTrafficRoutes(resourceMeshes) {
    return DATA_FLOW_CONNECTIONS.flatMap((connection) => {
        const sourceMesh = resourceMeshes.get(connection.sourceId);
        const targetMesh = resourceMeshes.get(connection.targetId);
        const sourceNode = DATA_FLOW_NODES.find((n) => n.id === connection.sourceId);
        if (!sourceMesh || !targetMesh) return [];

        return [{
            id: `route-${connection.id}`,
            sourceId: connection.sourceId,
            targetId: connection.targetId,
            sourcePos: sourceMesh.position.clone().add(new THREE.Vector3(0, 0.6, 0)),
            targetPos: targetMesh.position.clone().add(new THREE.Vector3(0, 0.6, 0)),
            payload: sourceNode?.dataOut || '',
            trafficType: connection.id === 'conn-pop-resp' ? 'healthy' : 'default',
            requestRate: 1.25
        }];
    });
}

export const BUILD_INFO={name:"SLAYER",version:"0.1.0",platform:"web",androidWrapper:"planned"} as const;
export interface ReleaseChecklist{compile:boolean;tests:boolean;performance:boolean;signed:boolean;qa:boolean}
export function validateRelease(c:ReleaseChecklist){return c.compile&&c.tests&&c.performance&&c.signed&&c.qa;}
// The ride: where the horse is on the road and where the camera follows it (third person, MMO style),
// as pure functions of time. Everything that's placed along the road reads it.
import * as THREE from 'three';
import { W0, OUT } from './timeline.js';
import { invLerp, easeInCubic } from './util.js';

/** The road's centre line (the ground along it is at y = 0). */
export const trailX = (z) => 1.1 * Math.sin(z * 0.055 + 0.5) - 0.45;

export const RIDE_SPEED = 4.2; // m/s, an easy canter
export const RIDE_Z0 = 6.0; // rider's z when the world appears
export const CAM_BACK = 7.0; // camera distance behind the rider
export const CAM_UP = 3.1; // camera height
export const CAM_PITCH = 4.5; // degrees up
export const CAM_SIDE = 1.5; // camera off to the left of the rider (a three-quarter view of the mount)

/** Rider z at time t: already cantering when the world appears. */
export function riderZ(t) {
  return RIDE_Z0 - RIDE_SPEED * Math.max(0, t - W0);
}

/** Direction of travel along the road at z (unit vector in the xz plane). */
export function roadDir(z) {
  const dz = -1, dx = trailX(z - 0.5) - trailX(z + 0.5);
  const l = Math.hypot(dx, dz);
  return new THREE.Vector3(dx / l, 0, dz / l);
}

/** Where the rider (horse) is at t: ground position on the road and heading. */
export function riderPose(t) {
  const z = riderZ(t);
  const pos = new THREE.Vector3(trailX(z), 0, z);
  const dir = roadDir(z);
  return { pos, dir, yaw: Math.atan2(dir.x, dir.z) };
}

/** The camera's base pose (no lunge): behind and above the rider, looking down the road and a little up. */
export function cameraBase(t) {
  const { pos: rp } = riderPose(t);
  const zc = rp.z + CAM_BACK;
  // heading: smoothed over the stretch of road ahead
  const a = new THREE.Vector3(trailX(zc), 0, zc);
  const b = new THREE.Vector3(trailX(rp.z - 10), 0, rp.z - 10);
  const fwd = b.sub(a).normalize();
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const pos = new THREE.Vector3(trailX(zc) * 0.6 + rp.x * 0.4, CAM_UP, zc).addScaledVector(right, -CAM_SIDE);
  // turned most of the way back toward the rider, so they stay near the middle and we still look down the road
  const yaw = Math.atan2(-fwd.x, -fwd.z) - 0.85 * Math.atan2(CAM_SIDE, CAM_BACK);
  const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(CAM_PITCH), yaw, 0, 'YXZ'));
  return { pos, quat };
}

/** The camera at t: smooth follow, plus the lunge into the vortex at the end. */
export function cameraPose(t) {
  const { pos, quat } = cameraBase(t);
  const v = easeInCubic(invLerp(OUT.vortex[0], OUT.vortex[1], t));
  if (v > 0) pos.add(new THREE.Vector3(0, 0.6, -1).applyQuaternion(quat).multiplyScalar(v * 4));
  return { pos, quat };
}

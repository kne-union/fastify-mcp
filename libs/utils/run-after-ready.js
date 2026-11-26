/**
 * 在 Fastify boot 完成（ready）之后调度任务，且不阻塞 `await fastify.ready()` / onReady 的 pluginTimeout。
 *
 * 原因：`@fastify/swagger` 的 `.swagger()` 只能在 ready 之后调用；而 sequelize `syncPromise`
 * 往往在插件注册阶段就 resolve，此时调 swagger 会抛错。长耗时 seed 若 await 在 onReady 里，
 * 又会触发 pluginTimeout。因此库内统一：ready 回调里只同步调度，实际工作放到下一 macrotick。
 *
 * 业务宿主应 `await fastify.mcp.seedPromise`（或依赖自动后台 seed），不要再包一层 setImmediate。
 *
 * @param {import('fastify').FastifyInstance} fastify
 * @param {() => Promise<unknown>} task
 * @returns {Promise<unknown>}
 */
const runAfterReady = (fastify, task) =>
  new Promise((resolve, reject) => {
    fastify.ready(err => {
      if (err) {
        reject(err);
        return;
      }
      setImmediate(() => {
        Promise.resolve().then(task).then(resolve).catch(reject);
      });
    });
  });

module.exports = { runAfterReady };

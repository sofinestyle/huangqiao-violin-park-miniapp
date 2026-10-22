export function contentTestFlag(environment) {
 if(!['development','staging','production'].includes(environment))throw new Error('未获取服务端运行环境，请刷新登录后重试');
 return environment!=='production';
}
export function contentForSave(content,environment) {
 const expected=contentTestFlag(environment);
 if(content.isTest!==expected)throw new Error(expected?'正式内容不能保存到测试环境':'旧测试内容须先按批准清单转正，普通保存不能自动转正');
 return {...content,isTest:expected};
}

import {hasVisitorIdentity} from '../../config';
import {ensureIdentity,go,message} from '../../lib/api';
Page({data:{hasIdentity:false,busy:false,error:''},onShow(){this.setData({hasIdentity:hasVisitorIdentity()});},async login(){this.setData({busy:true,error:''});try{await ensureIdentity();this.setData({hasIdentity:true});}catch(e){this.setData({error:message(e)});}finally{this.setData({busy:false});}},open(e:WechatMiniprogram.TouchEvent){go(e.currentTarget.dataset.url);}});

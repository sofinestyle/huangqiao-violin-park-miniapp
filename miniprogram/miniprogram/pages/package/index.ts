import {detailPage} from '../../lib/detail-page';import {go} from '../../lib/api';
Page({...detailPage(),book(){go('/pages/booking/index?id='+this.data.id);},group(){go('/pages/booking/index?id='+this.data.id+'&group=1');}});

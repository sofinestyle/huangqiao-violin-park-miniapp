import {listPage} from '../../lib/list-page';import {go} from '../../lib/api';
Page({...listPage('package','','工业研学·一把琴的诞生课堂'),enroll(){go('/pages/enrollments/index');},group(){go('/pages/booking/index?group=1');}});

import FormRender, { useForm } from 'form-render';
import React, { useEffect, useState, useRef } from 'react';
import {
  advancedElements,
  baseCommonSettings,
  defaultCommonSettings,
  defaultSettings,
  elements,
  layouts,
} from '../../settings';
import { isObject, mergeInOrder } from '../../utils';
import { useGlobal, useStore } from '../../utils/hooks';
import { getWidgetName } from '../../utils/mapping';
import * as frgWidgets from '../../widgets';

/**
 * ItemSettings 组件用于渲染当前选中表单项的配置面板。
 * 它根据选中项的 schema 和全局 widgets 配置，动态生成对应的设置表单。
 *
 * @param {Object} props - 组件属性
 * @param {Object} [props.widgets] - 外部传入的自定义 widgets，会与全局 widgets 合并使用
 * @returns {JSX.Element} 渲染出的设置表单界面
 */
export default function ItemSettings({ widgets }) {
  const setGlobal = useGlobal();
  const form = useForm();
  const isReady = useRef(false);
  const {
    selected,
    flatten,
    onItemChange,
    onItemErrorChange,
    userProps = {},
    widgets: globalWidgets,
    mapping: globalMapping,
  } = useStore();

  const { settings, commonSettings, hideId, validation, transformer } =
    userProps;
  const [settingSchema, setSettingSchema] = useState({});

  // 合并全局 widgets 和内部 widgets
  const _widgets = {
    ...globalWidgets,
    ...frgWidgets,
  };

  /**
   * 根据 settings 和 commonSettings 构造 widget 列表
   * 每个 widget 包含其 schema、widget 名称和 setting 配置
   *
   * @param {Array} settings - 用户传入的设置项数组
   * @param {Object} commonSettings - 公共设置项
   * @returns {Array} 处理后的 widget 列表
   */
  const getWidgetList = (settings, commonSettings) => {
    return settings.reduce((widgetList, setting) => {
      if (!Array.isArray(setting.widgets)) return widgetList;
      const basicWidgets = setting.widgets.map(item => {
        const baseItemSettings = {};
        if (item.schema.type === 'array' && item.schema.items) {
          baseItemSettings.items = {
            type: 'object',
            hidden: '{{true}}',
          };
        }
        return {
          ...item,
          widget:
            item.widget ||
            item.schema.widget ||
            getWidgetName(item.schema, globalMapping),
          setting: mergeInOrder(
            baseCommonSettings,
            commonSettings,
            baseItemSettings,
            item.setting
          ),
        };
      });
      return [...widgetList, ...basicWidgets];
    }, []);
  };

  /**
   * 当设置表单数据变化时，将数据转换为 schema 并通知外部更新
   *
   * @param {Object} value - 表单当前值
   */
  const onDataChange = (value = {}) => {
    try {
      if (selected === '#' || !isReady.current || !value.$id) return;
      const item = {
        ...flatten[selected],
        schema: transformer.fromSetting(value),
      };
      onItemChange(selected, item, 'schema');
    } catch (error) {
      console.error(error, 'catch');
    }
  };

  // 当选中项变化时，重新计算并设置 settingSchema
  useEffect(() => {
    // setting 该显示什么的计算，要把选中组件的 schema 和它对应的 widgets 的整体 schema 进行拼接
    try {
      isReady.current = false;
      const item = flatten[selected];
      if (!item || selected === '#') return;
      // 算 widgetList
      const _settings = Array.isArray(settings)
        ? [
            ...settings,
            { widgets: [...elements, ...advancedElements, ...layouts] },
          ] // TODO: 不是最优解
        : defaultSettings;
      const _commonSettings = isObject(commonSettings)
        ? commonSettings
        : defaultCommonSettings;
      const widgetList = getWidgetList(_settings, _commonSettings);
      const widgetName = getWidgetName(item.schema, globalMapping);
      const element = widgetList.find(e => e.widget === widgetName) || {}; // 有可能会没有找到
      const properties = { ...element.setting };

      if (hideId) delete properties.$id;

      setTimeout(() => {
        setSettingSchema({
          type: 'object',
          displayType: 'column',
          properties,
        });
        const value = transformer.toSetting(item.schema);
        form.setValues(value);
        onDataChange(form.getValues(true));
        validation && form.submit();
        isReady.current = true;
      }, 0);
    } catch (error) {
      isReady.current = true;
      console.error(error);
    }
  }, [selected]);

  // 监听表单校验状态变化，通知外部错误信息更新
  useEffect(() => {
    validation && onItemErrorChange(form?.getFieldsError());
  }, [validation, form?.getFieldsError()]);

  // 将当前 form 实例存入全局状态，供外部使用
  useEffect(() => {
    setGlobal({ settingsForm: form });
  }, []);

  return (
    <div style={{ paddingRight: 10 }}>
      <FormRender
        form={form}
        schema={settingSchema}
        widgets={{ ..._widgets, ...widgets }}
        mapping={globalMapping}
        removeHiddenData={false}
        watch={{
          '#': v => setTimeout(() => onDataChange(v), 0),
        }}
      />
    </div>
  );
}
